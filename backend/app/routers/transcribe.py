import io
import asyncio
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.config import settings
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])

HF_API_URL = "https://api-inference.huggingface.co/models/openai/whisper-base"
MAX_WARMUP_WAIT = 30  # seconds


def _convert_to_wav(audio_bytes: bytes) -> bytes:
    """
    Convert audio bytes (any format: webm, mp4, ogg…) to
    16-bit mono 16kHz WAV using PyAV (av package).

    PyAV bundles its own libav/ffmpeg shared libraries inside the pip
    wheel — no system ffmpeg or apt-get install required.
    Falls back to returning the original bytes if conversion fails.
    """
    try:
        import av
        import av.audio.resampler

        in_buf = io.BytesIO(audio_bytes)
        out_buf = io.BytesIO()

        in_container = av.open(in_buf)          # auto-detect format
        in_stream = in_container.streams.audio[0]

        out_container = av.open(out_buf, mode="w", format="wav")
        out_stream = out_container.add_stream("pcm_s16le", rate=16000)
        out_stream.layout = "mono"

        resampler = av.audio.resampler.AudioResampler(
            format="s16", layout="mono", rate=16000
        )

        for frame in in_container.decode(in_stream):
            for resampled in resampler.resample(frame):
                resampled.pts = None            # let PyAV assign timestamps
                for packet in out_stream.encode(resampled):
                    out_container.mux(packet)

        # Flush encoder
        for packet in out_stream.encode(None):
            out_container.mux(packet)

        out_container.close()
        in_container.close()

        wav_bytes = out_buf.getvalue()
        logger.info(f"[Transcribe] PyAV converted audio → WAV ({len(wav_bytes)} bytes)")
        return wav_bytes

    except Exception as e:
        logger.warning(f"[Transcribe] PyAV conversion failed ({e}) — sending original bytes to Whisper")
        return audio_bytes


async def _call_hf_with_warmup(audio_bytes: bytes, hf_headers: dict) -> dict:
    """
    POST audio to HuggingFace. If the model is loading (503 + estimated_time),
    wait up to MAX_WARMUP_WAIT seconds and retry once automatically.
    Returns the parsed JSON response dict on success, raises HTTPException otherwise.
    """
    for attempt in range(2):  # attempt 0 = first try, attempt 1 = after warmup wait
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(HF_API_URL, content=audio_bytes, headers=hf_headers)

        status = response.status_code
        # Always log the full response for Render debugging
        logger.info(f"[Transcribe] HF response (attempt {attempt + 1}): status={status}")
        logger.info(f"[Transcribe] HF response body: {response.text[:500]}")

        if status == 200:
            return response.json()

        if status == 503:
            body = {}
            try:
                body = response.json()
            except Exception:
                pass

            estimated = body.get("estimated_time", 20)
            wait_secs = min(float(estimated), MAX_WARMUP_WAIT)

            if attempt == 0:
                logger.warning(
                    f"[Transcribe] Model loading (503). "
                    f"estimated_time={estimated}s — waiting {wait_secs}s then retrying…"
                )
                await asyncio.sleep(wait_secs)
                continue  # retry once

            # Second attempt also 503 — give up
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Whisper model is still loading. "
                    f"Please wait ~{int(wait_secs)}s and try again."
                ),
            )

        if status == 401 or status == 403:
            logger.error(f"[Transcribe] HF auth error {status}: {response.text}")
            raise HTTPException(status_code=503, detail="Transcription service authentication failed.")

        # Any other non-200
        logger.error(f"[Transcribe] HF unexpected error {status}: {response.text}")
        raise HTTPException(
            status_code=502,
            detail=f"Transcription API returned an unexpected error (HTTP {status}).",
        )

    # Should never reach here
    raise HTTPException(status_code=503, detail="Transcription failed after retries.")


@router.post("", response_model=dict)
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Accept an audio file (webm/wav/mp4/ogg) uploaded from the browser's
    MediaRecorder, convert it to WAV, and transcribe via HuggingFace Whisper.
    Returns { "text": "transcribed text" }
    """
    if not settings.huggingface_api_key:
        raise HTTPException(
            status_code=503,
            detail="Transcription service not configured (missing HUGGINGFACE_API_KEY on server).",
        )

    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file received.")

    content_type = file.content_type or "audio/webm"
    filename = file.filename or "recording"
    logger.info(
        f"[Transcribe] Received: {filename} | "
        f"content_type={content_type} | size={len(audio_bytes)} bytes | "
        f"user={current_user.id}"
    )

    # Determine source format for pydub
    fmt_map = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "mp4",
        "audio/x-m4a": "m4a",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/wave": "wav",
    }
    src_format = fmt_map.get(content_type, "webm")

    # Convert to WAV (Whisper handles WAV most reliably)
    wav_bytes = _convert_to_wav(audio_bytes)

    hf_headers = {
        "Authorization": f"Bearer {settings.huggingface_api_key}",
        "Content-Type": "audio/wav",
    }

    try:
        result = await _call_hf_with_warmup(wav_bytes, hf_headers)
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error("[Transcribe] HF API timed out after 90s")
        raise HTTPException(status_code=504, detail="Transcription timed out. Please try again.")
    except Exception as e:
        logger.error(f"[Transcribe] Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed unexpectedly.")

    text = result.get("text", "").strip()
    logger.info(f"[Transcribe] Success — transcribed {len(text)} chars: {text[:80]}…")
    return {"text": text}
