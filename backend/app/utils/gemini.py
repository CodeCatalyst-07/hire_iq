import logging
import time
import asyncio
import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)

# Log the model being used at startup so we can verify in Render logs
logger.info(f"[Gemini] Configuring with model: {settings.gemini_model}")
logger.info(f"[Gemini] API key present: {bool(settings.gemini_api_key)} | key prefix: {settings.gemini_api_key[:8] if settings.gemini_api_key else 'MISSING'}")

genai.configure(api_key=settings.gemini_api_key)

# Strip 'models/' prefix if present - the SDK handles it automatically
_model_name = settings.gemini_model.replace("models/", "")


def get_gemini_model():
    return genai.GenerativeModel(_model_name)


def call_gemini(prompt: str, max_retries: int = 3, max_output_tokens: int | None = None) -> str:
    """Call Gemini API with exponential backoff on quota errors (sync).

    Args:
        prompt: The text prompt to send.
        max_retries: Number of retry attempts on quota/rate-limit errors.
        max_output_tokens: Hard cap on response length. Pass None (default)
            for unconstrained output (e.g. evaluate_answer). Pass an integer
            for structured JSON calls (e.g. parse_resume, generate_questions).
    """
    model = get_gemini_model()
    generation_config = genai.types.GenerationConfig(
        max_output_tokens=max_output_tokens,
    ) if max_output_tokens is not None else None
    last_err = None

    for attempt in range(max_retries):
        try:
            logger.info(f"[Gemini] Attempt {attempt + 1}/{max_retries} — model: {_model_name} | max_output_tokens: {max_output_tokens}")
            response = model.generate_content(prompt, generation_config=generation_config)

            # ── Opt 4B: token usage logging ──────────────────────────────────────
            try:
                output_tokens = response.usage_metadata.candidates_token_count
                logger.info(f"[TOKEN USAGE] output_tokens={output_tokens}")
            except Exception:
                pass  # usage_metadata may not be present on all SDK versions

            logger.info(f"[Gemini] Success on attempt {attempt + 1}")
            return response.text

        except Exception as e:
            last_err = e
            err_str = str(e)
            logger.error(f"[Gemini] Attempt {attempt + 1} failed: {type(e).__name__}: {err_str}")

            # Retry only on quota/rate-limit errors
            if "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower():
                wait = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(f"[Gemini] Rate limited — waiting {wait}s before retry")
                time.sleep(wait)
                continue

            # Don't retry on auth errors, model-not-found, etc.
            logger.error(f"[Gemini] Non-retryable error — aborting: {err_str}")
            raise

    logger.error(f"[Gemini] All {max_retries} attempts exhausted. Last error: {last_err}")
    raise last_err


async def async_call_gemini(
    prompt: str,
    max_retries: int = 3,
    max_output_tokens: int | None = None,
) -> str:
    """Non-blocking Gemini call — runs sync call_gemini in a thread pool.

    FastAPI's event loop is never blocked: the sync SDK call (including
    any time.sleep() retries) executes in asyncio's default thread executor.
    """
    return await asyncio.to_thread(call_gemini, prompt, max_retries, max_output_tokens)
