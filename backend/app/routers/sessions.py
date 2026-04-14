from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.interview import InterviewSession, InterviewAnswer, QuestionBank
from app.models.job import JobPosting
from app.models.user import User
from app.schemas.interview import StartSessionRequest, SessionOut, SubmitAnswerRequest, AnswerOut, SessionReportOut
from app.services.interview_service import evaluate_answer
from app.utils.auth import get_current_user
import statistics

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


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

    # Get question text from bank
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
        # Convert Decimal → float to avoid JSON serialization errors
        scores = [float(s) for s in [a.relevance_score, a.clarity_score, a.depth_score, a.confidence_score, a.structure_score] if s is not None]
        if scores:
            all_scores.append(statistics.mean(scores))

    overall = round(float(statistics.mean(all_scores)) * 10, 2) if all_scores else 0.0

    # Build summary — all values must be plain Python types (no Decimal)
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
