import hashlib
import io
import json
import logging
import os
import re
import pdfplumber
import docx
from cachetools import TTLCache
from app.utils.gemini import async_call_gemini

logger = logging.getLogger(__name__)

# ── Opt 3: in-process TTL cache keyed on MD5 of raw file bytes ──────────────
# maxsize=100 entries, ttl=3600s (1 hour). Process-local — cleared on restart.
_parse_cache: TTLCache = TTLCache(maxsize=100, ttl=3600)

# ── OCR: minimum characters to consider primary extraction successful ─────────
MIN_TEXT_LENGTH = 100   # chars after .strip() — anything less triggers OCR
MIN_OCR_RESULT  = 50    # chars after OCR — below this the scan is unreadable

# ── Conditional OCR imports (Tesseract not required for local dev) ────────────
try:
    import pytesseract
    from pdf2image import convert_from_bytes
    from PIL import Image
    TESSERACT_AVAILABLE = True
    logger.info("[OCR] pytesseract, pdf2image, Pillow loaded successfully")
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("[OCR] pytesseract/pdf2image/Pillow not installed — OCR fallback disabled")

# Image extensions that go straight to OCR (no text layer to try first)
_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp"}


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _extract_text_with_ocr(file_bytes: bytes, source_hint: str = "file") -> str:
    """Convert PDF pages or raw image bytes to text via Tesseract OCR.

    Called only when:
      (a) primary PDF extraction returned < MIN_TEXT_LENGTH characters, OR
      (b) the uploaded file is a direct image (JPG, PNG, TIFF, …).

    Raises ValueError with a user-readable message on all failure modes.
    """
    if not TESSERACT_AVAILABLE:
        raise ValueError(
            "OCR service unavailable. Please upload a digital PDF or DOCX file instead."
        )

    # ── Path 1: PDF → images via pdf2image, then OCR each page ───────────────
    try:
        logger.info(f"[OCR] Running pdf2image on {source_hint} (dpi=300)")
        images = convert_from_bytes(file_bytes, dpi=300)
        text_parts: list[str] = []
        for page_num, image in enumerate(images, start=1):
            page_text = pytesseract.image_to_string(image, lang="eng")
            logger.info(f"[OCR] Page {page_num}: {len(page_text)} chars extracted")
            text_parts.append(page_text)
        return "\n".join(text_parts).strip()

    except Exception as pdf_err:
        logger.info(f"[OCR] pdf2image path failed ({type(pdf_err).__name__}), trying direct Image.open")

    # ── Path 2: direct image file (JPG, PNG, TIFF, …) ────────────────────────
    try:
        image = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(image, lang="eng").strip()
        logger.info(f"[OCR] Direct image OCR: {len(text)} chars extracted")
        return text

    except pytesseract.TesseractNotFoundError:
        raise ValueError(
            "OCR service unavailable. Please upload a digital PDF or DOCX file instead."
        )
    except Exception as img_err:
        raise ValueError(f"OCR extraction failed: {img_err}")


def extract_text(file_bytes: bytes, filename: str) -> tuple[str, bool]:
    """Extract raw text from PDF, DOCX, or image file.

    Returns:
        (text, used_ocr) — used_ocr=True when Tesseract was invoked.

    Decision tree:
        .docx  → python-docx (unchanged)
        .pdf   → pdfplumber → PyMuPDF if empty → OCR if < MIN_TEXT_LENGTH
        image  → OCR directly
        other  → raises ValueError
    """
    fname = filename.lower()
    used_ocr = False

    # ── DOCX ──────────────────────────────────────────────────────────────────
    if fname.endswith(".docx"):
        document = docx.Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in document.paragraphs), False

    # ── PDF ───────────────────────────────────────────────────────────────────
    if fname.endswith(".pdf"):
        # Stage 1: pdfplumber (unchanged)
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)

        # Stage 2: PyMuPDF if pdfplumber returned nothing (unchanged)
        if not text.strip():
            import fitz
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)

        # Stage 3: OCR if both text-layer methods returned insufficient text
        if len(text.strip()) < MIN_TEXT_LENGTH:
            logger.info(
                f"[OCR] Primary extraction returned {len(text.strip())} chars "
                f"(threshold={MIN_TEXT_LENGTH}) — falling back to PyTesseract"
            )
            text = _extract_text_with_ocr(file_bytes, source_hint=filename)
            logger.info(f"[OCR] Extracted {len(text)} characters via Tesseract")
            used_ocr = True

        return text, used_ocr

    # ── Images (JPG, PNG, TIFF, BMP, WEBP) ───────────────────────────────────
    ext = os.path.splitext(fname)[1]
    if ext in _IMAGE_EXTENSIONS:
        logger.info(f"[OCR] Image upload detected ({ext}) — running PyTesseract directly")
        text = _extract_text_with_ocr(file_bytes, source_hint=filename)
        logger.info(f"[OCR] Extracted {len(text)} characters from image")
        return text, True

    raise ValueError(f"Unsupported file type: {filename}")


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

async def parse_resume(file_bytes: bytes, filename: str) -> dict:
    """Extract text then call Gemini to structure it.

    Results are cached by MD5 hash of the raw bytes for 1 hour (Opt 3).
    Gemini call is non-blocking via async_call_gemini (Opt 1).
    OCR-sourced text skips the 1500-token cap (OCR output can be noisier).
    """
    from fastapi import HTTPException  # local import avoids circular import

    # ── Cache lookup ──────────────────────────────────────────────────────────
    file_hash = hashlib.md5(file_bytes).hexdigest()
    if file_hash in _parse_cache:
        logger.info(f"[parse_resume] Cache HIT for hash {file_hash[:8]}…")
        return _parse_cache[file_hash]

    # ── Extract text (raises ValueError on unrecoverable failures) ───────────
    try:
        resume_text, used_ocr = extract_text(file_bytes, filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # ── OCR readability check ─────────────────────────────────────────────────
    if used_ocr and len(resume_text.strip()) < MIN_OCR_RESULT:
        logger.warning(
            f"[OCR] Extracted only {len(resume_text.strip())} chars after OCR — "
            "image likely blurry or unreadable"
        )
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not extract readable text from this file. "
                "Please ensure the image is clear and high resolution, "
                "or upload a digital PDF or DOCX instead."
            ),
        )

    if used_ocr:
        logger.info(f"[OCR] Sending {len(resume_text)} OCR chars to Gemini (uncapped)")

    prompt = f"""You are an expert resume parser. Extract all information from this resume.

IMPORTANT: Return ONLY a valid JSON object. No markdown formatting, no code fences (no ```), no explanation text before or after. Raw JSON only.

Resume Text:
{resume_text}

Return this exact JSON structure:
{{
  "name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "linkedin_url": "string or null",
  "github_url": "string or null",
  "current_title": "string or null",
  "total_years_experience": 0,
  "education": [
    {{"degree": "string", "field": "string", "institution": "string", "year": null}}
  ],
  "experience": [
    {{
      "title": "string",
      "company": "string",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or Present",
      "duration_months": 0,
      "description": "string",
      "technologies": ["string"]
    }}
  ],
  "skills": {{
    "hard_skills": ["string"],
    "soft_skills": ["string"],
    "tools": ["string"],
    "languages": ["string"]
  }},
  "certifications": ["string"],
  "projects": [
    {{"name": "string", "description": "string", "technologies": ["string"]}}
  ],
  "parse_confidence": 85
}}"""

    # OCR text is noisier → no token cap. Digital text uses 1500-token cap (Opt 4B).
    if used_ocr:
        raw = await async_call_gemini(prompt)
    else:
        raw = await async_call_gemini(prompt, max_output_tokens=1500)

    # Strip any accidental markdown fences (safety net)
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
    try:
        result = json.loads(cleaned)
        _parse_cache[file_hash] = result  # store in cache
        return result
    except json.JSONDecodeError:
        # Return a minimal fallback so we don't crash the upload
        return {
            "name": "Unknown",
            "email": None,
            "phone": None,
            "location": None,
            "linkedin_url": None,
            "github_url": None,
            "current_title": None,
            "total_years_experience": 0,
            "education": [],
            "experience": [],
            "skills": {"hard_skills": [], "soft_skills": [], "tools": [], "languages": []},
            "certifications": [],
            "projects": [],
            "parse_confidence": 0,
        }
