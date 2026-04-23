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

# ── OCR thresholds ───────────────────────────────────────────────────────────
MIN_TEXT_LENGTH = 100   # chars after .strip() — below this triggers OCR
MIN_OCR_RESULT  = 50    # chars after OCR — below this scan is unreadable

# ── Conditional EasyOCR import (pure Python — no system deps) ────────────────
# easyocr downloads ~100 MB of ML models on first initialisation (cached
# in ~/.EasyOCR/).  The import itself is fast; Reader() init is slow (once).
try:
    import easyocr as _easyocr_module
    EASYOCR_AVAILABLE = True
    logger.info("[OCR] easyocr loaded successfully")
except ImportError:
    EASYOCR_AVAILABLE = False
    logger.warning("[OCR] easyocr not installed — OCR fallback disabled")

# Lazy singleton — initialised once on first OCR call, reused for all requests
_ocr_reader = None

# Image extensions that go straight to OCR (no text layer to try first)
_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp"}


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_ocr_reader():
    """Return the shared EasyOCR Reader, initialising it on first call."""
    global _ocr_reader
    if _ocr_reader is None:
        logger.info("[OCR] Initialising EasyOCR Reader (models download on first run)…")
        _ocr_reader = _easyocr_module.Reader(["en"], gpu=False, verbose=False)
        logger.info("[OCR] EasyOCR Reader ready")
    return _ocr_reader


def _extract_text_with_ocr(file_bytes: bytes, source_hint: str = "file") -> str:
    """Run EasyOCR on a scanned PDF or image file.

    For PDFs, PyMuPDF (already a project dependency) renders each page to PNG
    bytes at 300 DPI — no poppler / pdf2image / system package required.
    For image files, EasyOCR reads the raw bytes directly.

    Raises ValueError with a user-readable message on all failure modes.
    """
    if not EASYOCR_AVAILABLE:
        raise ValueError(
            "OCR service unavailable. Please upload a digital PDF or DOCX file instead."
        )

    reader = _get_ocr_reader()

    # ── Path 1: scanned PDF — render pages with PyMuPDF → OCR each page ──────
    try:
        import fitz  # PyMuPDF — already in requirements.txt
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text_parts: list[str] = []
        # 300 DPI ≈ scale factor 300/72 ≈ 4.17 from PyMuPDF's 72-DPI base
        mat = fitz.Matrix(300 / 72, 300 / 72)
        for page_num, page in enumerate(doc, start=1):
            png_bytes = page.get_pixmap(matrix=mat).tobytes("png")
            results: list[str] = reader.readtext(png_bytes, detail=0)
            page_text = " ".join(results)
            logger.info(f"[OCR] Page {page_num}: {len(page_text)} chars")
            text_parts.append(page_text)
        return "\n".join(text_parts).strip()

    except Exception as pdf_err:
        logger.info(
            f"[OCR] PDF render path failed ({type(pdf_err).__name__}): {pdf_err} "
            "— trying direct image OCR"
        )

    # ── Path 2: direct image file (JPG, PNG, TIFF, BMP, WEBP) ────────────────
    try:
        results = reader.readtext(file_bytes, detail=0)
        text = " ".join(results).strip()
        logger.info(f"[OCR] Direct image OCR: {len(text)} chars extracted")
        return text
    except Exception as img_err:
        raise ValueError(f"OCR extraction failed: {img_err}")


def extract_text(file_bytes: bytes, filename: str) -> tuple[str, bool]:
    """Extract raw text from a PDF, DOCX, or image file.

    Returns:
        (text, used_ocr) — used_ocr=True when EasyOCR was invoked.

    Decision tree:
        .docx  → python-docx                          (unchanged)
        .pdf   → pdfplumber → PyMuPDF → EasyOCR OCR  (if < MIN_TEXT_LENGTH)
        image  → EasyOCR directly
        other  → raises ValueError
    """
    fname = filename.lower()

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

        # Stage 3: EasyOCR if both text-layer methods returned insufficient text
        if len(text.strip()) < MIN_TEXT_LENGTH:
            logger.info(
                f"[OCR] Primary extraction returned {len(text.strip())} chars "
                f"(threshold={MIN_TEXT_LENGTH}) — falling back to EasyOCR"
            )
            text = _extract_text_with_ocr(file_bytes, source_hint=filename)
            logger.info(f"[OCR] Extracted {len(text)} characters via EasyOCR")
            return text, True

        return text, False

    # ── Images (JPG, PNG, TIFF, BMP, WEBP) ───────────────────────────────────
    ext = os.path.splitext(fname)[1]
    if ext in _IMAGE_EXTENSIONS:
        logger.info(f"[OCR] Image upload detected ({ext}) — running EasyOCR directly")
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

    # ── OCR readability gate ──────────────────────────────────────────────────
    if used_ocr and len(resume_text.strip()) < MIN_OCR_RESULT:
        logger.warning(
            f"[OCR] Only {len(resume_text.strip())} chars after EasyOCR — "
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

    # OCR text is noisier → no token cap. Digital text keeps 1500-token cap (Opt 4B).
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
