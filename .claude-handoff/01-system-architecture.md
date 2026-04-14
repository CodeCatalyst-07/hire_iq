# 01 — System Architecture

## Overview

HireIQ is a multi-service AI-assisted recruitment platform. The backend exposes a **single FastAPI REST API** that the React frontend (running on Vite, port 5173) communicates with over HTTP.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API Framework** | FastAPI (Python 3.11+) |
| **ORM** | SQLAlchemy 2.x (async) with `asyncpg` driver |
| **Database** | PostgreSQL 15 |
| **Migrations** | Alembic |
| **Task Queue** | Celery + Redis (for async resume parsing jobs) |
| **Cache** | Redis |
| **File Storage** | AWS S3 (or local MinIO for development) |
| **AI/LLM** | OpenAI GPT-4o via `openai` SDK |
| **PDF Extraction** | `pdfplumber` + fallback `PyMuPDF` |
| **DOCX Extraction** | `python-docx` |
| **Auth** | JWT (access + refresh tokens) via `python-jose` |
| **Schema Validation** | Pydantic v2 |
| **CORS** | FastAPI `CORSMiddleware` allowing `http://localhost:5173` |

---

## Service Boundaries

The FastAPI monolith is internally split into **three logical service modules** under `app/services/`:

### 1. `resume_parser.py`
- Accepts a raw file buffer (PDF or DOCX)
- Extracts plain text using `pdfplumber` or `python-docx`
- Sends text to GPT-4o with a structured JSON extraction prompt
- Returns a `ParsedCandidate` Pydantic model

### 2. `scoring_engine.py`
- Accepts a `ParsedCandidate` + a `JobPosting` model
- Computes weighted scores across 6 dimensions:
  - Skills Match (35%), Experience Relevance (25%), Education Fit (15%), Certifications (10%), Project Quality (10%), Profile Completeness (5%)
- Returns a `CandidateScore` model with `total_score` (0–100) and per-dimension breakdowns

### 3. `interview_service.py`
- Question Generation: Given a `CandidateProfile` + `JobPosting`, calls GPT-4o to produce a structured `QuestionBank`
- Answer Evaluation: Given a question + candidate answer text, calls GPT-4o with a rubric prompt to return per-dimension scores (Relevance, Clarity, Depth, Confidence, Structure)

---

## Request Lifecycle (Resume Upload)

```
POST /api/candidates/upload
  → Validate file type
  → Store raw file in S3
  → Dispatch Celery task: parse_resume.delay(candidate_id, s3_url)
  → Return 202 Accepted with { candidate_id, status: "parsing" }

[Celery Worker]
  → Download file from S3
  → Extract text (pdfplumber / python-docx)
  → Call GPT-4o for structured extraction
  → Run scoring engine against job_id
  → Update candidate_profiles table (parse_status = "complete")
  → Emit WebSocket event (optional) OR polling via GET /api/candidates/{id}
```

---

## Environment Variables (.env)

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/hireiq
REDIS_URL=redis://localhost:6379/0
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=hireiq-resumes
OPENAI_API_KEY=sk-...
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
FRONTEND_URL=http://localhost:5173
```

---

## CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Auth Strategy

- **Registration / Login** → Returns `access_token` (15min JWT) + `refresh_token` (7-day JWT stored in HttpOnly cookie)
- **Protected routes** → Use `Depends(get_current_user)` FastAPI dependency
- **Roles**: `admin`, `recruiter`, `candidate` — stored in the `users.role` column
- Middleware checks role on sensitive endpoints (e.g., only `recruiter`/`admin` can access leaderboard)
