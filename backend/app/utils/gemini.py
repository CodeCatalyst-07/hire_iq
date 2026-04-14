import time
import google.generativeai as genai
from app.config import settings

genai.configure(api_key=settings.gemini_api_key)

# Strip 'models/' prefix if present - the SDK handles it automatically
_model_name = settings.gemini_model.replace("models/", "")


def get_gemini_model():
    return genai.GenerativeModel(_model_name)


def call_gemini(prompt: str, max_retries: int = 3) -> str:
    """Call Gemini API with exponential backoff on quota errors."""
    model = get_gemini_model()
    last_err = None
    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            last_err = e
            err_str = str(e)
            # Retry on quota/rate-limit errors
            if "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower():
                wait = 2 ** attempt  # 1s, 2s, 4s
                time.sleep(wait)
                continue
            # Don't retry on other errors (auth, model not found, etc.)
            raise
    raise last_err
