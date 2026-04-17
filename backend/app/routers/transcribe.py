import io
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.config import settings
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])

GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_MODEL = "whisper-large-v3"


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


@router.post("", response_model=dict)
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Accept an audio file (webm/wav/mp4/ogg) uploaded from the browser's
    MediaRecorder, convert it to WAV, and transcribe via Groq Whisper API.
    Returns { "text": "transcribed text" }
    """
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=503,
            detail="Transcription service not configured (missing GROQ_API_KEY on server).",
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

    # Convert to WAV (Whisper handles WAV most reliably)
    wav_bytes = _convert_to_wav(audio_bytes)

    # Send to Groq Whisper API as multipart/form-data
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                files={
                    "file": ("audio.wav", wav_bytes, "audio/wav"),
                },
                data={"model": GROQ_MODEL},
            )

        status = response.status_code
        logger.info(f"[Transcribe] Groq response: status={status}")
        logger.info(f"[Transcribe] Groq response body: {response.text[:500]}")

        if status == 200:
            result = response.json()
            text = result.get("text", "").strip()
            logger.info(f"[Transcribe] Success — {len(text)} chars: {text[:80]}…")
            return {"text": text}

        if status in (401, 403):
            logger.error(f"[Transcribe] Groq auth error {status}: {response.text}")
            raise HTTPException(status_code=503, detail="Transcription service authentication failed.")

        logger.error(f"[Transcribe] Groq unexpected error {status}: {response.text}")
        raise HTTPException(
            status_code=502,
            detail=f"Transcription API returned an unexpected error (HTTP {status}).",
        )

    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error("[Transcribe] Groq API timed out after 60s")
        raise HTTPException(status_code=504, detail="Transcription timed out. Please try again.")
    except Exception as e:
        logger.error(f"[Transcribe] Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed unexpectedly.")
