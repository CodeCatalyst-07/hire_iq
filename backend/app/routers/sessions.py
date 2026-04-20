from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.interview import InterviewSession, InterviewAnswer, QuestionBank
from app.models.candidate import Candidate, CandidateProfile
from app.models.job import JobPosting
from app.models.user import User
from app.schemas.interview import (
    StartSessionRequest, SessionOut, SubmitAnswerRequest, AnswerOut,
    SessionReportOut, SessionListItem, SessionInsights, DimensionScores,
)
from app.services.interview_service import evaluate_answer
from app.utils.auth import get_current_user
import statistics

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


# ── List sessions (must be before /{session_id}) ────────────────────────────

@router.get("", response_model=dict)
def list_sessions(
    job_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all interview sessions for jobs owned by the current user.
    Optionally filter by job_id. Joins through Candidate and JobPosting
    to include candidate name and job title.
    """
    # Get IDs of jobs owned by this user
    owned_job_ids = [
        str(j.id)
        for j in db.query(JobPosting.id)
        .filter(JobPosting.created_by == current_user.id, JobPosting.status != "deleted")
        .all()
    ]

    query = (
        db.query(InterviewSession)
        .join(JobPosting, InterviewSession.job_id == JobPosting.id)
        .filter(JobPosting.created_by == current_user.id, JobPosting.status != "deleted")
    )

    if job_id:
        query = query.filter(InterviewSession.job_id == job_id)

    sessions = query.order_by(InterviewSession.started_at.desc()).all()

    items = []
    for s in sessions:
        # Get candidate name
        candidate = db.query(Candidate).filter(Candidate.id == s.candidate_id).first()
        candidate_name = candidate.name if candidate else "Unknown Candidate"

        # Get job title
        job = db.query(JobPosting).filter(JobPosting.id == s.job_id).first()
        job_title = job.title if job else "Unknown Job"

        items.append(SessionListItem(
            id=str(s.id),
            candidate_name=candidate_name,
            job_title=job_title,
            status=s.status,
            overall_score=float(s.overall_score or 0),
            started_at=s.started_at,
            completed_at=s.completed_at,
        ).model_dump())

    return {"data": items}


# ── Performance insights (must be before /{session_id}) ─────────────────────

@router.get("/insights", response_model=dict)
def get_insights(
    job_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregate performance analytics across all sessions owned by this user.
    Optionally filter by job_id. Returns avg dimension scores and weakest dim.
    """
    # Build base query scoped to current user's jobs
    session_query = (
        db.query(InterviewSession)
        .join(JobPosting, InterviewSession.job_id == JobPosting.id)
        .filter(JobPosting.created_by == current_user.id, JobPosting.status != "deleted")
    )
    if job_id:
        session_query = session_query.filter(InterviewSession.job_id == job_id)

    sessions = session_query.all()
    total = len(sessions)
    completed = sum(1 for s in sessions if s.status == "completed")

    overall_scores = [float(s.overall_score) for s in sessions if s.overall_score]
    avg_overall = round(statistics.mean(overall_scores), 1) if overall_scores else 0.0

    # Aggregate answer-level dimension scores
    dim_sums = {"relevance": 0.0, "clarity": 0.0, "depth": 0.0, "confidence": 0.0, "structure": 0.0}
    dim_counts = {k: 0 for k in dim_sums}

    for s in sessions:
        answers = db.query(InterviewAnswer).filter(InterviewAnswer.session_id == s.id).all()
        for a in answers:
            for dim, col in [
                ("relevance", a.relevance_score),
                ("clarity", a.clarity_score),
                ("depth", a.depth_score),
                ("confidence", a.confidence_score),
                ("structure", a.structure_score),
            ]:
                if col is not None:
                    dim_sums[dim] += float(col)
                    dim_counts[dim] += 1

    dims = {
        k: round(dim_sums[k] / dim_counts[k], 1) if dim_counts[k] > 0 else 0.0
        for k in dim_sums
    }

    weakest = min(dims, key=lambda k: dims[k]) if any(v > 0 for v in dims.values()) else "confidence"

    insights = SessionInsights(
        total_sessions=total,
        completed_sessions=completed,
        avg_overall_score=avg_overall,
        dimensions=DimensionScores(**dims),
        weakest_dimension=weakest,
    )
    return {"data": insights.model_dump()}


# ── Create session ───────────────────────────────────────────────────────────

@router.post("", response_model=dict, status_code=201)
def start_session(
    body: StartSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = InterviewSession(
        candidate_id=body.candidate_id,
        job_id=body.job_id,
        question_bank_id=body.question_bank_id,
        mode=body.mode,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"data": SessionOut.model_validate(session).model_dump()}


# ── Submit answer ────────────────────────────────────────────────────────────

@router.post("/{session_id}/answers", response_model=dict, status_code=201)
def submit_answer(
    session_id: str,
    body: SubmitAnswerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    bank = db.query(QuestionBank).filter(QuestionBank.id == session.question_bank_id).first()
    question_text = body.question_id
    if bank:
        for q in (bank.questions or []):
            if q.get("id") == body.question_id:
                question_text = q.get("question", body.question_id)
                break

    job = db.query(JobPosting).filter(JobPosting.id == session.job_id).first()
    job_title = job.title if job else "the role"

    result = evaluate_answer(question_text, body.answer_text, job_title)

    answer = InterviewAnswer(
        session_id=session.id,
        question_id=body.question_id,
        answer_text=body.answer_text,
        relevance_score=result["relevance_score"],
        clarity_score=result["clarity_score"],
        depth_score=result["depth_score"],
        confidence_score=result["confidence_score"],
        structure_score=result["structure_score"],
        feedback=result["feedback"],
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)

    return {"data": AnswerOut.model_validate(answer).model_dump()}


# ── Complete session ─────────────────────────────────────────────────────────

@router.post("/{session_id}/complete", response_model=dict)
def complete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = db.query(InterviewAnswer).filter(InterviewAnswer.session_id == session_id).all()

    all_scores = []
    for a in answers:
        scores = [float(s) for s in [a.relevance_score, a.clarity_score, a.depth_score, a.confidence_score, a.structure_score] if s is not None]
        if scores:
            all_scores.append(statistics.mean(scores))

    overall = round(float(statistics.mean(all_scores)) * 10, 2) if all_scores else 0.0

    summary = {
        "top_strength": "Strong overall performance",
        "top_gap": "Continue practicing structured responses",
        "total_answers": len(answers),
        "overall_score": float(overall),
    }

    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)
    session.overall_score = overall
    session.feedback_summary = summary
    db.commit()
    db.refresh(session)

    return {"data": SessionOut.model_validate(session).model_dump()}


# ── Get full report ──────────────────────────────────────────────────────────

@router.get("/{session_id}/report", response_model=dict)
def get_report(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = db.query(InterviewAnswer).filter(InterviewAnswer.session_id == session_id).all()
    answers_data = [
        {
            "question_id": a.question_id,
            "answer_text": a.answer_text,
            "scores": {
                "relevance": float(a.relevance_score or 0),
                "clarity": float(a.clarity_score or 0),
                "depth": float(a.depth_score or 0),
                "confidence": float(a.confidence_score or 0),
                "structure": float(a.structure_score or 0),
            },
            "feedback": a.feedback,
        }
        for a in answers
    ]

    return {
        "data": {
            "session_id": str(session.id),
            "overall_score": float(session.overall_score or 0),
            "status": session.status,
            "feedback_summary": session.feedback_summary,
            "answers": answers_data,
        }
    }
