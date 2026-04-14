# 02 — Database Schema

All tables use PostgreSQL 15. Use Alembic for migrations. All primary keys are UUIDs.

---

## Table: `organizations`

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    plan_tier VARCHAR(50) DEFAULT 'free',  -- free | pro | enterprise
    settings_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Table: `users`

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'recruiter',  -- admin | recruiter | candidate
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(org_id);
```

---

## Table: `job_postings`

```sql
CREATE TABLE job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    required_skills TEXT[] DEFAULT '{}',
    nice_to_have_skills TEXT[] DEFAULT '{}',
    scoring_weights_json JSONB DEFAULT '{
        "skills_match": 0.35,
        "experience": 0.25,
        "education": 0.15,
        "certifications": 0.10,
        "projects": 0.10,
        "completeness": 0.05
    }',
    status VARCHAR(50) DEFAULT 'active',  -- active | closed | draft
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_org_status ON job_postings(org_id, status);
```

---

## Table: `candidates`

```sql
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    location VARCHAR(255),
    linkedin_url VARCHAR(500),
    github_url VARCHAR(500),
    source VARCHAR(100) DEFAULT 'manual',  -- manual | invite | portal
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Table: `candidate_profiles`

This is the core table. One row per (candidate, job) combination.

```sql
CREATE TABLE candidate_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
    raw_resume_url VARCHAR(1000),      -- S3 URL
    parsed_data_json JSONB DEFAULT '{}',  -- full structured extraction from GPT-4o
    total_score NUMERIC(5,2) DEFAULT 0,
    score_breakdown_json JSONB DEFAULT '{}',
    skill_match_pct NUMERIC(5,2) DEFAULT 0,
    experience_years NUMERIC(4,1) DEFAULT 0,
    education_level VARCHAR(100),
    parse_status VARCHAR(50) DEFAULT 'pending',  -- pending | parsing | complete | failed
    parse_confidence NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_job_score ON candidate_profiles(job_id, total_score DESC);
CREATE INDEX idx_profiles_candidate ON candidate_profiles(candidate_id);
CREATE UNIQUE INDEX idx_profiles_candidate_job ON candidate_profiles(candidate_id, job_id);
```

---

## Table: `question_banks`

```sql
CREATE TABLE question_banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES job_postings(id),
    candidate_profile_id UUID REFERENCES candidate_profiles(id),
    questions_json JSONB NOT NULL,  -- array of question objects (see AI integrations doc)
    generation_model VARCHAR(100) DEFAULT 'gpt-4o',
    generated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `questions_json` Structure

```json
[
  {
    "id": "q1",
    "category": "technical",
    "question": "Can you explain...",
    "purpose": "Test architectural depth",
    "difficulty": "medium",
    "expected_framework": "STAR",
    "follow_up_probes": ["Tell me more about X", "How did Y impact the result?"]
  }
]
```

---

## Table: `interview_sessions`

```sql
CREATE TABLE interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id),
    job_id UUID REFERENCES job_postings(id),
    question_bank_id UUID REFERENCES question_banks(id),
    mode VARCHAR(50) DEFAULT 'practice',  -- practice | simulation
    status VARCHAR(50) DEFAULT 'pending',  -- pending | in_progress | completed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    overall_score NUMERIC(5,2),
    feedback_summary_json JSONB DEFAULT '{}'
);
```

---

## Table: `interview_answers`

```sql
CREATE TABLE interview_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
    question_id VARCHAR(50) NOT NULL,  -- references question_bank.questions_json[].id
    answer_text TEXT,
    audio_url VARCHAR(1000),           -- S3 URL for audio recording (future)
    transcript TEXT,
    relevance_score NUMERIC(4,2),
    clarity_score NUMERIC(4,2),
    depth_score NUMERIC(4,2),
    confidence_score NUMERIC(4,2),
    structure_score NUMERIC(4,2),
    feedback_json JSONB DEFAULT '{}',
    answered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_answers_session ON interview_answers(session_id);
```

---

## Table: `activity_logs` (Audit Trail)

```sql
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

---

## SQLAlchemy Models Note

Create one file per logical group in `app/models/`:
- `user.py` → `Organization`, `User`
- `job.py` → `JobPosting`
- `candidate.py` → `Candidate`, `CandidateProfile`
- `interview.py` → `QuestionBank`, `InterviewSession`, `InterviewAnswer`
- `audit.py` → `ActivityLog`

Use `mapped_column` and `Mapped` with SQLAlchemy 2.x declarative style.
