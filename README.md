# HireIQ — AI-Powered Recruitment Platform

HireIQ is a full-stack recruitment platform that uses Google Gemini AI to:
- **Parse resumes** (PDF/DOCX) and extract structured candidate data
- **Score candidates** automatically against job requirements
- **Generate tailored interview questions** based on skills, gaps, role, and resume projects
- **Conduct mock interviews** with live AI evaluation across 5 dimensions
- **Produce detailed feedback reports** with per-question breakdowns
- **Compare candidates** side-by-side across all performance dimensions
- **Save and reuse question templates** for recurring roles

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

## Features

### 🎯 Jobs Section
- **Job Listings Board** — view all jobs as cards with title, department, applicant count, and status (Open / Closed / Draft)
- **Create & Edit Jobs** — fields for title, department, required skills, experience level, and description
- **Job Analytics** — per-job stats: total applicants, average match score, shortlist rate
- **Job Status Management** — toggle between Open, Closed, and Archive states
- **Job Detail Page** — clicking a job card shows its candidates with match scores and a skill-gap chart

### 📋 Interviews Section
- **Session History Board** — view all past mock interview sessions filterable by job role
- **Performance Insights** — aggregate dimension scores (Relevance, Clarity, Depth, Confidence, Structure) across all sessions, with weakest dimension highlighted
- **Delete Session** — remove a session with a confirmation guard

### 🧠 Project Based Questions
- If a candidate's resume includes projects, HireIQ auto-generates **2 project-specific questions** referencing the actual project names, technologies, and outcomes
- Project questions appear **first** in the question list and under their own "Project Based" tab
- If no projects exist in the resume, the standard **10 questions** are generated (unchanged)
- When projects are found, the total becomes **12 questions**

### 📊 Candidate Comparison
- Select **up to 3 completed sessions** from the Interviews page using checkboxes
- A floating action bar slides up once ≥2 sessions are selected
- The `/compare` page shows a **side-by-side table** with:
  - Overall score per candidate
  - All 5 dimension scores as animated progress bars
  - ⭐ marker and green highlight on the **best performer per dimension**
  - 🏆 Top Performer badge on the overall winner
  - Strengths and areas to improve per candidate

### 📁 Interview Templates
- After generating questions, click **"Save as Template"** to store the question bank with a name and job role tag
- Templates are saved to the database and reusable across different candidates
- Click **"Load Template"** to browse saved templates filtered by role and load them instantly (replaces current question set)
- Delete templates you no longer need directly from the load modal

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
│   │   └── interviews.ts       # Questions, sessions, answers, report, templates
│   ├── context/
│   │   └── AuthContext.tsx     # Global auth state (token, user, logout)
│   ├── components/
│   │   ├── LandingPage.tsx
│   │   ├── Dashboard.tsx       # Candidates list + job selector + upload modal
│   │   ├── CandidateProfile.tsx
│   │   ├── JobsPage.tsx        # Job listings board + create/edit
│   │   ├── JobDetailPage.tsx   # Per-job analytics + candidate list
│   │   ├── InterviewsPage.tsx  # Session history + performance insights
│   │   ├── ComparisonPage.tsx  # Side-by-side candidate comparison (/compare)
│   │   ├── InterviewQuestions.tsx  # Generated questions + save/load templates
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
│   │   │   ├── auth.py
│   │   │   ├── jobs.py
│   │   │   ├── candidates.py
│   │   │   ├── questions.py
│   │   │   ├── sessions.py
│   │   │   ├── templates.py    # Interview template CRUD
│   │   │   ├── dashboard.py
│   │   │   └── transcribe.py
│   │   ├── services/
│   │   │   ├── resume_parser.py     # PDF/DOCX text → Gemini → structured JSON
│   │   │   ├── interview_service.py # Question gen + answer evaluation (Gemini)
│   │   │   └── scoring_engine.py    # Weighted candidate match scoring
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

> ✅ Tables are **auto-created** in Supabase on first startup — no migrations needed. This includes all new tables: `job_postings`, `interview_sessions`, `interview_templates`, etc.

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
Jobs Section (/jobs)
    → Create a Job Posting (title, department, required skills, experience level)
    → Manage status: Open / Closed / Draft
    → View per-job analytics: total applicants, avg match score, shortlist rate
    ↓
Dashboard — Upload Resume for a Job
    → Gemini parses PDF/DOCX → extracts skills, experience, projects, education
    → Scoring engine calculates match % against job requirements
    ↓
Candidate Profile — review parsed data + score breakdown + skill gap chart
    ↓
Generate Questions
    → Gemini creates 10–12 tailored questions:
        - 4 Technical Deep Dive
        - 2 Skill Gap Probes
        - 2 Behavioral (STAR format)
        - 1 Culture Fit
        - 1 Motivation/Ambition
        - 2 Project Based (only if resume has projects — references exact project names)
    → Optionally: Save as Template for future reuse
    → Optionally: Load a previously saved Template to skip regeneration
    ↓
Mock Interview Session — answer each question in text (or voice via Groq Whisper)
    → Gemini evaluates each answer: Relevance, Clarity, Depth, Confidence, Structure (each /10)
    ↓
Feedback Report — overall score + per-question analysis + strengths/gaps
    ↓
Interviews Section (/interviews)
    → View all past sessions, filterable by job role
    → Performance insights: avg dimension scores, weakest dimension highlighted
    → Delete sessions you no longer need
    ↓
Candidate Comparison (/compare)
    → Select 2–3 completed sessions (checkboxes on session cards)
    → Side-by-side table: overall scores, all 5 dimension bars
    → Best performer per dimension highlighted (⭐ + green)
    → 🏆 Top Performer badge on the overall winner
    → Strengths and improvement areas per candidate
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
| GET | `/api/jobs/{id}` | Get job details |
| PATCH | `/api/jobs/{id}` | Update job |
| GET | `/api/jobs/{id}/stats` | Per-job analytics (applicants, avg score, shortlist rate) |
| DELETE | `/api/jobs/{id}` | Soft-delete a job |
| POST | `/api/candidates/upload` | Upload & parse resume |
| GET | `/api/candidates` | List candidates for a job |
| GET | `/api/candidates/{id}` | Get candidate profile |
| PATCH | `/api/candidates/{id}` | Update candidate status |
| POST | `/api/questions/generate` | Generate interview questions (10 or 12 with projects) |
| GET | `/api/questions/{id}` | Get question bank |
| GET | `/api/sessions` | List all sessions for current user (filterable by job_id) |
| POST | `/api/sessions` | Start interview session |
| GET | `/api/sessions/compare` | Compare up to 3 sessions side-by-side (`?ids=id1,id2,id3`) |
| GET | `/api/sessions/insights` | Aggregate dimension scores + weakest dim (filterable by job_id) |
| POST | `/api/sessions/{id}/answers` | Submit + evaluate answer |
| POST | `/api/sessions/{id}/complete` | Complete session |
| GET | `/api/sessions/{id}/report` | Get feedback report |
| DELETE | `/api/sessions/{id}` | Delete a session (ownership-checked) |
| POST | `/api/templates` | Save a question bank as a reusable template |
| GET | `/api/templates` | List saved templates (filterable by `?job_role=`) |
| DELETE | `/api/templates/{id}` | Delete a template (ownership-checked) |
| GET | `/api/dashboard/stats` | Resume/shortlist stats |

---

## Security Notes

- `.env` files are listed in `.gitignore` — **never commit them**
- Use `.env.example` as a template when onboarding new developers
- All API routes (except register/login/health) require a valid JWT `Authorization: Bearer <token>` header
- The `JWT_SECRET_KEY` should be a cryptographically random 32+ character string
- All session and template endpoints enforce **ownership checks** — users can only access their own data
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

**Comparison page shows "No sessions to compare"**
→ Only **completed** sessions can be compared. Make sure the selected sessions have status `completed` (i.e. the mock interview was finished, not just started).

**Templates not appearing in Load modal**
→ Templates are scoped per user. Make sure you're logged in with the same account that saved them.
