import io
import json
import re
import pdfplumber
import docx
from app.utils.gemini import call_gemini


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


def parse_resume(file_bytes: bytes, filename: str) -> dict:
    """Extract text then call Gemini to structure it."""
    resume_text = extract_text(file_bytes, filename)

    prompt = f"""You are an expert resume parser. Extract all information from this resume and return ONLY a valid JSON object with no markdown, no code fences, just raw JSON.

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

    raw = call_gemini(prompt)

    # Strip any accidental markdown fences
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
    try:
        return json.loads(cleaned)
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
