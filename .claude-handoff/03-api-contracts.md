# 03 — API Contracts

Base URL: `http://localhost:8000/api`

All responses follow the envelope:
```json
{ "data": {}, "error": null }
```
Error responses:
```json
{ "data": null, "error": { "code": "NOT_FOUND", "message": "...", "retryable": false } }
```

---

## Auth Endpoints

### `POST /api/auth/register`
**Body:**
```json
{ "email": "recruiter@co.com", "password": "...", "full_name": "Alice", "role": "recruiter" }
```
**Response:** `201` → `{ "user": {...}, "access_token": "...", "token_type": "bearer" }`

---

### `POST /api/auth/login`
**Body:** `{ "email": "...", "password": "..." }`
**Response:** `200` → `{ "access_token": "...", "token_type": "bearer" }`
Sets `refresh_token` HttpOnly cookie.

---

### `POST /api/auth/refresh`
Uses `refresh_token` cookie.
**Response:** `200` → `{ "access_token": "...", "token_type": "bearer" }`

---

### `POST /api/auth/logout`
Clears refresh_token cookie.
**Response:** `200`

---

## Job Postings

### `GET /api/jobs`
**Auth:** Recruiter+
**Response:** List of `JobPosting` objects for the org.

---

### `POST /api/jobs`
**Body:**
```json
{
  "title": "Senior Frontend Engineer",
  "description": "We are looking for...",
  "required_skills": ["React", "TypeScript", "Node.js"],
  "nice_to_have_skills": ["GraphQL", "AWS"],
  "scoring_weights": {
    "skills_match": 0.35,
    "experience": 0.25,
    "education": 0.15,
    "certifications": 0.10,
    "projects": 0.10,
    "completeness": 0.05
  }
}
```
**Response:** `201` → Full `JobPosting` object.

---

### `GET /api/jobs/{job_id}`
**Response:** Full `JobPosting` including candidate count.

---

### `PATCH /api/jobs/{job_id}`
Update status or scoring weights.

---

## Candidates

### `POST /api/candidates/upload`
**Auth:** Recruiter+
**Content-Type:** `multipart/form-data`
**Form Fields:**
- `file`: Binary (PDF or DOCX)
- `job_id`: UUID string

**Response:** `202 Accepted`
```json
{
  "candidate_id": "uuid",
  "profile_id": "uuid",
  "status": "parsing",
  "message": "Resume uploaded. Parsing in progress."
}
```

---

### `GET /api/candidates`
**Query Params:** `job_id` (required), `status`, `min_score`, `max_score`, `page`, `limit`
**Response:** Paginated list of `CandidateProfile` objects, sorted by `total_score DESC`.

```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "candidate": { "id": "uuid", "name": "Eleanor Sterling", "email": "..." },
        "total_score": 96.2,
        "skill_match_pct": 94.0,
        "experience_years": 7,
        "education_level": "Master's",
        "parse_status": "complete",
        "status": "shortlisted"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

---

### `GET /api/candidates/{profile_id}`
Full profile with `parsed_data_json` and `score_breakdown_json` expanded.

---

### `PATCH /api/candidates/{profile_id}`
Update `status` (shortlisted / reviewing / pending / rejected) or manually correct parsed data.

---

### `GET /api/candidates/{profile_id}/status`
Polling endpoint for parse status during async processing.
```json
{ "data": { "status": "parsing", "progress_pct": 60 } }
```

---

## Interview Questions

### `POST /api/questions/generate`
**Body:**
```json
{ "profile_id": "uuid", "job_id": "uuid" }
```
Triggers GPT-4o question generation. Returns immediately with the question bank.

**Response:** `201`
```json
{
  "data": {
    "question_bank_id": "uuid",
    "questions": [
      {
        "id": "q1",
        "category": "technical",
        "question": "Can you explain...",
        "purpose": "Tests architectural depth",
        "difficulty": "medium",
        "follow_up_probes": ["...", "..."]
      }
    ]
  }
}
```

---

### `GET /api/questions/{question_bank_id}`
Retrieve a previously generated question bank.

---

## Mock Interview Sessions

### `POST /api/sessions`
Start a new session.
**Body:**
```json
{ "candidate_id": "uuid", "job_id": "uuid", "question_bank_id": "uuid", "mode": "practice" }
```
**Response:** `201` → `{ "session_id": "uuid", "status": "in_progress" }`

---

### `POST /api/sessions/{session_id}/answers`
Submit one answer.
**Body:**
```json
{ "question_id": "q1", "answer_text": "In my experience at TechNova..." }
```
**Response:** `201` → Per-answer scores + feedback.
```json
{
  "data": {
    "relevance_score": 9.2,
    "clarity_score": 8.5,
    "depth_score": 9.0,
    "confidence_score": 7.8,
    "structure_score": 8.0,
    "feedback": {
      "strength": "Excellent use of concrete metrics.",
      "gap": "Could structure using the STAR framework more explicitly.",
      "sample_answer": "..."
    }
  }
}
```

---

### `POST /api/sessions/{session_id}/complete`
Mark session as completed and trigger full report generation.
**Response:** `200` → Full session report with overall score and summary.

---

### `GET /api/sessions/{session_id}/report`
Retrieve the complete feedback report.
```json
{
  "data": {
    "session_id": "uuid",
    "overall_score": 88.2,
    "status": "completed",
    "feedback_summary": {
      "top_strength": "Architectural understanding",
      "top_gap": "Verbose behavioral answers",
      "recommendation": "Practice STAR method for behavioral questions"
    },
    "answers": [ ...per-answer breakdown... ]
  }
}
```

---

## Dashboard / Analytics

### `GET /api/dashboard/stats`
**Auth:** Recruiter+
**Response:**
```json
{
  "data": {
    "total_resumes": 1248,
    "shortlisted": 42,
    "avg_match_score": 84.3,
    "pending_review": 18
  }
}
```

---

## Frontend ↔ API Field Mapping

| Frontend Display | API Field |
|-----------------|-----------|
| "Match %" bar | `total_score` from `candidate_profiles` |
| "Shortlisted" badge | `status` field updated via `PATCH /api/candidates/{id}` |
| "Generate Questions" button | `POST /api/questions/generate` |
| "Submit Answer" button | `POST /api/sessions/{id}/answers` |
| "Session Feedback Report" | `GET /api/sessions/{id}/report` |
