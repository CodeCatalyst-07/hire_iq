# HireIQ — AI-Powered Recruitment Platform

HireIQ is a full-stack recruitment platform that uses Google Gemini AI to:
- **Parse resumes** (PDF/DOCX) and extract structured candidate data
- **Score candidates** automatically against job requirements
- **Generate tailored interview questions** based on skills, gaps, and role
- **Conduct mock interviews** with live AI evaluation across 5 dimensions
- **Produce detailed feedback reports** with per-question breakdowns

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Framer Motion |
| Backend | FastAPI (Python 3.9+), SQLAlchemy, Pydantic v2 |
| Database | Supabase (PostgreSQL) |
| AI | Google Gemini API (`gemini-flash-latest`) |
| Auth | JWT (python-jose + passlib bcrypt) |

---

## Prerequisites

Make sure you have the following installed:

- **Node.js** ≥ 18 and **npm** ≥ 9
- **Python** ≥ 3.9
- A **Supabase** account (free tier works) → [supabase.com](https://supabase.com)
- A **Google Gemini API key** → [aistudio.google.com](https://aistudio.google.com)

---

## Project Structure

```
Capstone/
├── src/                        # React frontend
│   ├── api/                    # Axios API service layer
│   │   ├── client.ts           # Axios instance + auth interceptors
│   │   ├── auth.ts             # Login / register / me
│   │   ├── jobs.ts             # Job CRUD
│   │   ├── candidates.ts       # Resume upload, profile, stats
│   │   └── interviews.ts       # Questions, sessions, answers, report
│   ├── context/
│   │   └── AuthContext.tsx     # Global auth state (token, user, logout)
│   ├── components/
│   │   ├── LandingPage.tsx
│   │   ├── Dashboard.tsx       # Candidates list + job selector + upload modal
│   │   ├── CandidateProfile.tsx
│   │   ├── InterviewQuestions.tsx
│   │   ├── MockSession.tsx
│   │   └── FeedbackReport.tsx
│   └── pages/
│       └── LoginPage.tsx       # Sign in / Create account
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app + CORS
│   │   ├── config.py           # Pydantic settings (reads .env)
│   │   ├── database.py         # SQLAlchemy engine + session
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── routers/            # API route handlers
│   │   ├── services/
│   │   │   ├── resume_parser.py    # PDF/DOCX text → Gemini → structured JSON
│   │   │   ├── interview_service.py # Question gen + answer evaluation (Gemini)
│   │   │   └── scoring_engine.py   # Weighted candidate match scoring
│   │   └── utils/
│   │       ├── gemini.py       # Gemini API wrapper with retry logic
│   │       └── auth.py         # JWT creation + password hashing
│   ├── requirements.txt
│   ├── .env.example            # Template — copy to .env
│   └── .gitignore
├── .env.example                # Frontend env template
├── .gitignore
└── README.md
```

---

## Setup — Backend

### 1. Create virtual environment and install dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `backend/.env` and fill in your values:

```env
# Supabase PostgreSQL connection string
# ⚠️  If your password contains '@', replace it with '%40'
DATABASE_URL=postgresql+psycopg2://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

GEMINI_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-flash-latest

# Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=<strong-random-secret>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

FRONTEND_URL=http://localhost:5173
```

### 3. Get your Supabase credentials

1. Go to [supabase.com](https://supabase.com) → your project → **Settings → Database**
2. Copy the **Connection String (Transaction pooler)** — this is your `DATABASE_URL`
3. Go to **Settings → API** to find your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### 4. Start the backend server

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

> ✅ Tables are **auto-created** in Supabase on first startup — no migrations needed.

Backend will be live at **http://localhost:8000**
- Interactive docs: **http://localhost:8000/docs**
- Health check: **http://localhost:8000/api/health**

---

## Setup — Frontend

### 1. Install dependencies

```bash
# From the project root
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

The default `.env` content is:
```env
VITE_API_URL=http://localhost:8000
```

This points the frontend at your local backend. Change it if you deploy the backend elsewhere.

### 3. Start the development server

```bash
npm run dev
```

Frontend will be live at **http://localhost:5173**

---

## Running Both Together

Open **two terminal windows**:

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

Then visit **http://localhost:5173** in your browser.

---

## Full User Flow

```
Register / Login
    ↓
Dashboard — Create a Job Posting
    ↓
Upload Resume (PDF or DOCX)
    → Gemini parses text → extracts skills, experience, education
    → Scoring engine calculates match % against job requirements
    ↓
Candidate Profile — review parsed data + score breakdown
    ↓
Generate Questions
    → Gemini creates 10 tailored questions (Technical, Behavioral, Skill Gap, Culture Fit)
    ↓
Mock Interview Session — answer each question in text
    → Gemini evaluates each answer: Relevance, Clarity, Depth, Confidence, Structure (each /10)
    ↓
Feedback Report — overall score + per-question analysis + strengths/gaps
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/jobs` | List jobs |
| POST | `/api/jobs` | Create job |
| POST | `/api/candidates/upload` | Upload & parse resume |
| GET | `/api/candidates` | List candidates for a job |
| GET | `/api/candidates/{id}` | Get candidate profile |
| PATCH | `/api/candidates/{id}` | Update status |
| POST | `/api/questions/generate` | Generate interview questions |
| GET | `/api/questions/{id}` | Get question bank |
| POST | `/api/sessions` | Start interview session |
| POST | `/api/sessions/{id}/answers` | Submit + evaluate answer |
| POST | `/api/sessions/{id}/complete` | Complete session |
| GET | `/api/sessions/{id}/report` | Get feedback report |
| GET | `/api/dashboard/stats` | Resume/shortlist stats |

---

## Security Notes

- `.env` files are listed in `.gitignore` — **never commit them**
- Use `.env.example` as a template when onboarding new developers
- All API routes (except register/login/health) require a valid JWT `Authorization: Bearer <token>` header
- The `JWT_SECRET_KEY` should be a cryptographically random 32+ character string
- For production: set `allow_origins` in `backend/app/main.py` to your specific frontend domain instead of `"*"`

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Supabase) |
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `GEMINI_MODEL` | ✅ | Gemini model name (e.g. `gemini-flash-latest`) |
| `JWT_SECRET_KEY` | ✅ | Strong random secret for JWT signing |
| `JWT_ALGORITHM` | ✅ | `HS256` |
| `JWT_EXPIRE_MINUTES` | ✅ | Token lifetime (e.g. `1440` = 24 hours) |
| `FRONTEND_URL` | ✅ | Frontend origin for CORS |

### Frontend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ | Backend base URL (e.g. `http://localhost:8000`) |

---

## Troubleshooting

**`OperationalError: password authentication failed`**
→ Check your `DATABASE_URL`. If your password contains `@`, encode it as `%40`.

**`404 models/gemini-1.5-flash not found`**
→ Update `GEMINI_MODEL` in `.env` to `gemini-flash-latest` (or check available models via the API).

**`429 Quota exceeded` on Gemini**
→ The free tier has rate limits. Wait a few seconds and retry. The backend has automatic exponential backoff built in.

**CORS errors in browser**
→ Make sure `FRONTEND_URL` in `backend/.env` matches your frontend origin exactly. The backend also whitelists `http://localhost:5173` by default.

**`bcrypt` error on Python 3.9**
→ Make sure `bcrypt==4.0.1` is installed: `pip install bcrypt==4.0.1`
