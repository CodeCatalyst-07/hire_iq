# 04 — AI Integrations

All LLM calls use the **OpenAI Python SDK** (`openai>=1.0.0`) with GPT-4o.
Always use `response_format={"type": "json_object"}` for structured extraction.
Implement retry logic: 3 attempts with exponential backoff (2s, 4s, 8s).

---

## 1. Resume Parsing

### File: `app/services/resume_parser.py`

**Step 1 — Text Extraction**
```python
import pdfplumber
import docx

def extract_text(file_bytes: bytes, filename: str) -> str:
    if filename.endswith(".pdf"):
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    elif filename.endswith(".docx"):
        doc = docx.Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs)
    raise ValueError("Unsupported file type")
```

**Step 2 — LLM Structured Extraction**

System prompt:
```
You are an expert resume parser. Extract all information from the provided resume text and return a valid JSON object. Be precise and do not infer information that is not explicitly stated.
```

User prompt template:
```
Extract the following structured data from this resume text:

{resume_text}

Return ONLY a JSON object with these exact keys:
{
  "name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "linkedin_url": "string or null",
  "github_url": "string or null",
  "current_title": "string or null",
  "total_years_experience": number,
  "education": [
    { "degree": "string", "field": "string", "institution": "string", "year": number or null }
  ],
  "experience": [
    {
      "title": "string",
      "company": "string",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or 'Present'",
      "duration_months": number,
      "description": "string",
      "technologies": ["string"]
    }
  ],
  "skills": {
    "hard_skills": ["string"],
    "soft_skills": ["string"],
    "tools": ["string"],
    "languages": ["string"]
  },
  "certifications": ["string"],
  "projects": [
    { "name": "string", "description": "string", "technologies": ["string"] }
  ],
  "parse_confidence": number between 0 and 100
}
```

---

## 2. Candidate Scoring Engine

### File: `app/services/scoring_engine.py`

No LLM needed — this is pure Python logic.

```python
def compute_score(parsed_profile: dict, job: JobPosting) -> CandidateScore:
    weights = job.scoring_weights_json  # e.g. {"skills_match": 0.35, ...}

    # Skills Match (0-100)
    required = set(s.lower() for s in job.required_skills)
    candidate_skills = set(s.lower() for s in parsed_profile["skills"]["hard_skills"] + parsed_profile["skills"]["tools"])
    matched = required & candidate_skills
    skills_score = (len(matched) / len(required) * 100) if required else 0

    # Bonus for nice-to-have skills
    nice_to_have = set(s.lower() for s in job.nice_to_have_skills)
    bonus = len(nice_to_have & candidate_skills) * 2  # 2 points each, capped
    skills_score = min(100, skills_score + bonus)

    # Experience Score (0-100)
    required_yoe = 3  # Extract from JD or config
    actual_yoe = parsed_profile.get("total_years_experience", 0)
    exp_score = min(actual_yoe / max(required_yoe, 1), 1.5) * 100

    # Education Score (0-100)
    edu_map = {"phd": 100, "master's": 85, "bachelor's": 70, "associate": 50, "high school": 30}
    highest_edu = parsed_profile.get("education", [{}])[0].get("degree", "").lower()
    edu_score = next((v for k, v in edu_map.items() if k in highest_edu), 50)

    # Certifications Score (0-100)
    cert_score = min(len(parsed_profile.get("certifications", [])) * 25, 100)

    # Projects Score (0-100)
    projects = parsed_profile.get("projects", [])
    proj_score = min(len(projects) * 20, 100)

    # Completeness Score (0-100)
    required_fields = ["name", "email", "skills", "experience", "education"]
    filled = sum(1 for f in required_fields if parsed_profile.get(f))
    completeness_score = (filled / len(required_fields)) * 100

    total = (
        skills_score * weights["skills_match"] +
        exp_score * weights["experience"] +
        edu_score * weights["education"] +
        cert_score * weights["certifications"] +
        proj_score * weights["projects"] +
        completeness_score * weights["completeness"]
    )

    return {
        "total_score": round(total, 2),
        "skill_match_pct": round(skills_score, 2),
        "breakdown": {
            "skills_match": round(skills_score, 2),
            "experience": round(exp_score, 2),
            "education": round(edu_score, 2),
            "certifications": round(cert_score, 2),
            "projects": round(proj_score, 2),
            "completeness": round(completeness_score, 2),
        },
        "matched_skills": list(matched),
        "missing_skills": list(required - candidate_skills),
    }
```

---

## 3. Interview Question Generation

### File: `app/services/interview_service.py`

System prompt:
```
You are an expert technical interviewer and talent acquisition specialist. Generate structured, behaviorally distinct interview questions based on the candidate profile and job description provided.
```

User prompt template:
```
Generate exactly 10 interview questions for the following candidate applying for this role.

CANDIDATE PROFILE:
{candidate_json}

JOB DESCRIPTION:
Title: {job_title}
Required Skills: {required_skills}
Nice-to-Have: {nice_to_have_skills}
Missing Skills (skill gaps): {missing_skills}

Generate questions in these EXACT proportions:
- 4 Technical Deep Dive questions (based on claimed skills)
- 2 Skill Gap Probe questions (testing missing/weak skills directly)
- 2 Behavioral questions (STAR-format situational scenarios)
- 1 Culture Fit question
- 1 Motivation/Ambition question

Return ONLY a JSON array with this structure:
[
  {
    "id": "q1",
    "category": "technical | skill_gap | behavioral | culture_fit | motivation",
    "question": "Full question text",
    "purpose": "1-sentence reason this question is relevant for this candidate",
    "difficulty": "easy | medium | hard",
    "expected_framework": "STAR | CAR | direct | open",
    "follow_up_probes": ["Follow-up 1", "Follow-up 2"]
  }
]
```

---

## 4. Answer Evaluation

### File: `app/services/interview_service.py` → `evaluate_answer()`

System prompt:
```
You are an expert career coach and technical interviewer evaluating a candidate's interview response. Be precise, constructive, and specific. Score rigorously — do not inflate scores.
```

User prompt template:
```
Evaluate this interview answer:

QUESTION: {question}
CANDIDATE ANSWER: {answer_text}
ROLE CONTEXT: {job_title} at a tech company

Score on exactly these 5 dimensions (each 0-10):
- Relevance: Does it answer what was asked?
- Clarity: Is it well-structured and easy to follow?
- Depth: Does it demonstrate genuine expertise?
- Confidence: Does it sound confident vs. hedging ("I think", "maybe")?
- Structure: Does it follow a clear framework (STAR/CAR)?

Return ONLY this JSON:
{
  "scores": {
    "relevance": 8.5,
    "clarity": 7.0,
    "depth": 9.0,
    "confidence": 6.5,
    "structure": 7.5
  },
  "feedback": {
    "strength": "1-2 sentences on what was done well",
    "gap": "1-2 sentences on what was missing or weak",
    "sample_answer": "A 2-3 sentence improved answer demonstrating best practice"
  },
  "overall_comment": "Short coaching summary for the candidate"
}
```

---

## 5. Requirements

Add to `requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.29.0
alembic==1.13.3
pydantic==2.9.0
pydantic-settings==2.5.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.12
openai==1.51.0
pdfplumber==0.11.4
PyMuPDF==1.24.12
python-docx==1.1.2
celery==5.4.0
redis==5.1.1
boto3==1.35.36
httpx==0.27.2
```
