import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.config import settings
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])

HF_API_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3"
ALLOWED_MIME_TYPES = {"audio/webm", "audio/wav", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/x-m4a"}


@router.post("", response_model=dict)
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Accept an audio file (webm/wav/ogg) and transcribe it using
    Hugging Face Inference API with openai/whisper-large-v3.
    Returns { "text": "transcribed text" }
    """
    if not settings.huggingface_api_key:
        raise HTTPException(status_code=503, detail="Transcription service not configured (missing HUGGINGFACE_API_KEY)")

    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file received")

    logger.info(f"[Transcribe] Received audio: {file.filename} ({len(audio_bytes)} bytes)")

    headers = {
        "Authorization": f"Bearer {settings.huggingface_api_key}",
        "Content-Type": file.content_type or "audio/webm",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(HF_API_URL, content=audio_bytes, headers=headers)

        logger.info(f"[Transcribe] HF API response status: {response.status_code}")

        if response.status_code == 503:
            # Model is loading — common for free HF tier
            raise HTTPException(
                status_code=503,
                detail="Whisper model is loading, please wait 20 seconds and try again.",
            )

        if response.status_code != 200:
            logger.error(f"[Transcribe] HF error: {response.text}")
            raise HTTPException(
                status_code=502,
                detail=f"Transcription API error: {response.status_code}",
            )

        result = response.json()
        text = result.get("text", "").strip()
        logger.info(f"[Transcribe] Success — transcribed {len(text)} chars")
        return {"text": text}

    except httpx.TimeoutException:
        logger.error("[Transcribe] HF API timed out after 60s")
        raise HTTPException(status_code=504, detail="Transcription timed out. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Transcribe] Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed unexpectedly.")
