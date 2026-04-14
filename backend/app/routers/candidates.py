import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.candidate import Candidate, CandidateProfile
from app.models.job import JobPosting
from app.models.user import User
from app.schemas.candidate import CandidateProfileOut, CandidateProfileUpdate, UploadResponse
from app.services.resume_parser import parse_resume
from app.services.scoring_engine import compute_score
from app.utils.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/candidates", tags=["candidates"])

ALLOWED_TYPES = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
ALLOWED_EXTENSIONS = {".pdf", ".docx"}


@router.post("/upload", response_model=dict, status_code=202)
def upload_resume(
    file: UploadFile = File(...),
    job_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    file_bytes = file.file.read()
    if len(file_bytes) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {settings.max_file_size_mb}MB")

    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Save file locally
    os.makedirs(settings.upload_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    local_path = os.path.join(settings.upload_dir, f"{file_id}{ext}")
    with open(local_path, "wb") as f:
        f.write(file_bytes)

    # Parse resume with Gemini
    parsed_data = parse_resume(file_bytes, file.filename or f"resume{ext}")

    # Create candidate from extracted data
    candidate = Candidate(
        name=parsed_data.get("name", "Unknown"),
        email=parsed_data.get("email"),
        phone=parsed_data.get("phone"),
        location=parsed_data.get("location"),
        linkedin_url=parsed_data.get("linkedin_url"),
        github_url=parsed_data.get("github_url"),
    )
    db.add(candidate)
    db.flush()

    # Compute score
    score_result = compute_score(parsed_data, job)

    # Create profile
    profile = CandidateProfile(
        candidate_id=candidate.id,
        job_id=job.id,
        raw_resume_url=local_path,
        parsed_data=parsed_data,
        total_score=score_result["total_score"],
        score_breakdown=score_result["score_breakdown"],
        skill_match_pct=score_result["skill_match_pct"],
        experience_years=score_result["experience_years"],
        education_level=score_result["education_level"],
        parse_status="complete",
        parse_confidence=parsed_data.get("parse_confidence", 80),
        status="pending",
    )
    db.add(profile)
    db.commit()
    db.refresh(candidate)
    db.refresh(profile)

    return {
        "data": UploadResponse(
            candidate_id=candidate.id,
            profile_id=profile.id,
            status="complete",
            message="Resume uploaded and parsed successfully.",
        ).model_dump()
    }


@router.get("", response_model=dict)
def list_candidates(
    job_id: str,
    status: Optional[str] = None,
    min_score: float = 0,
    max_score: float = 100,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.job_id == job_id)
        .filter(CandidateProfile.total_score >= min_score)
        .filter(CandidateProfile.total_score <= max_score)
    )
    if status:
        query = query.filter(CandidateProfile.status == status)

    total = query.count()
    profiles = (
        query.order_by(CandidateProfile.total_score.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "data": {
            "items": [CandidateProfileOut.model_validate(p).model_dump() for p in profiles],
            "total": total,
            "page": page,
            "limit": limit,
        }
    }


@router.get("/{profile_id}", response_model=dict)
def get_candidate(profile_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    profile = db.query(CandidateProfile).filter(CandidateProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"data": CandidateProfileOut.model_validate(profile).model_dump()}


@router.patch("/{profile_id}", response_model=dict)
def update_candidate(
    profile_id: str,
    body: CandidateProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(CandidateProfile).filter(CandidateProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, val)
    db.commit()
    db.refresh(profile)
    return {"data": CandidateProfileOut.model_validate(profile).model_dump()}
