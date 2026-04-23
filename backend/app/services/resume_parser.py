import hashlib
import io
import json
import re
import pdfplumber
import docx
from cachetools import TTLCache
from app.utils.gemini import async_call_gemini

# ── Opt 3: in-process TTL cache keyed on MD5 of raw file bytes ──────────────
# maxsize=100 entries, ttl=3600s (1 hour). Process-local — cleared on restart.
_parse_cache: TTLCache = TTLCache(maxsize=100, ttl=3600)


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Extract raw text from PDF or DOCX."""
    fname = filename.lower()
    if fname.endswith(".pdf"):
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        if not text.strip():
            # Fallback: PyMuPDF
            import fitz
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
        return text
    elif fname.endswith(".docx"):
        document = docx.Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in document.paragraphs)
    raise ValueError(f"Unsupported file type: {filename}")


async def parse_resume(file_bytes: bytes, filename: str) -> dict:
    """Extract text then call Gemini to structure it.

    Results are cached by MD5 hash of the raw bytes for 1 hour (Opt 3).
    Gemini call is non-blocking via async_call_gemini (Opt 1).
    """
    # ── Cache lookup ─────────────────────────────────────────────────────────
    file_hash = hashlib.md5(file_bytes).hexdigest()
    if file_hash in _parse_cache:
        import logging
        logging.getLogger(__name__).info(f"[parse_resume] Cache HIT for hash {file_hash[:8]}…")
        return _parse_cache[file_hash]

    resume_text = extract_text(file_bytes, filename)

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

    raw = await async_call_gemini(prompt)

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
