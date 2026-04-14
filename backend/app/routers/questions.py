from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.interview import QuestionBank
from app.models.candidate import CandidateProfile
from app.models.job import JobPosting
from app.models.user import User
from app.schemas.interview import GenerateQuestionsRequest, QuestionBankOut
from app.services.interview_service import generate_questions
from app.services.scoring_engine import compute_score
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.post("/generate", response_model=dict, status_code=201)
def generate(
    body: GenerateQuestionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(CandidateProfile).filter(CandidateProfile.id == body.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    job = db.query(JobPosting).filter(JobPosting.id == body.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Calculate missing skills for gap probes
    parsed = profile.parsed_data or {}
    score_result = compute_score(parsed, job)
    missing = score_result.get("missing_skills", [])

    questions = generate_questions(
        parsed_profile=parsed,
        job_title=job.title,
        required_skills=job.required_skills or [],
        nice_to_have=job.nice_to_have_skills or [],
        missing_skills=missing,
    )

    if not questions:
        raise HTTPException(
            status_code=503,
            detail="AI question generation failed (Gemini API unavailable or quota exceeded). Please try again in a few seconds."
        )

    bank = QuestionBank(
        job_id=job.id,
        candidate_profile_id=profile.id,
        questions=questions,
    )
    db.add(bank)
    db.commit()
    db.refresh(bank)

    return {"data": QuestionBankOut.model_validate(bank).model_dump()}


@router.get("/{question_bank_id}", response_model=dict)
def get_question_bank(
    question_bank_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bank = db.query(QuestionBank).filter(QuestionBank.id == question_bank_id).first()
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    return {"data": QuestionBankOut.model_validate(bank).model_dump()}
