-- HireIQ Database Performance Indexes
-- Run once in Supabase SQL Editor → SQL Editor → New query → Run
-- All table names verified against SQLAlchemy models.

-- ── candidate_profiles ──────────────────────────────────────────────────────
-- Fast lookup by job_id (used by listCandidates, getJobStats)
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_job_id
  ON candidate_profiles(job_id);

-- ── interview_sessions ──────────────────────────────────────────────────────
-- Fast lookup by job_id (list_sessions joins through job_postings)
CREATE INDEX IF NOT EXISTS idx_interview_sessions_job_id
  ON interview_sessions(job_id);

-- Fast filter by status (compare endpoint filters completed sessions)
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status
  ON interview_sessions(status);

-- Compound: job + status (covers list_sessions filtered by job_id + status)
CREATE INDEX IF NOT EXISTS idx_interview_sessions_job_status
  ON interview_sessions(job_id, status);

-- ── interview_templates ─────────────────────────────────────────────────────
-- Fast filtered lookup for Load Template modal (user + job_role filter)
CREATE INDEX IF NOT EXISTS idx_interview_templates_user_role
  ON interview_templates(created_by, job_role);

-- ── job_postings ─────────────────────────────────────────────────────────────
-- Fast listing by creator + status (all list_sessions ownership checks)
CREATE INDEX IF NOT EXISTS idx_job_postings_user_status
  ON job_postings(created_by, status);
