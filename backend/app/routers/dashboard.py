from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.candidate import CandidateProfile
from app.models.job import JobPosting
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=dict)
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Get IDs of jobs owned by this user
    user_job_ids = (
        db.query(JobPosting.id)
        .filter(JobPosting.created_by == current_user.id, JobPosting.status != "deleted")
        .subquery()
    )

    # Count only candidates that belong to the current user's jobs
    total_resumes = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.job_id.in_(user_job_ids))
        .count()
    )
    shortlisted = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.job_id.in_(user_job_ids), CandidateProfile.status == "shortlisted")
        .count()
    )
    pending_review = (
        db.query(CandidateProfile)
        .filter(CandidateProfile.job_id.in_(user_job_ids), CandidateProfile.status == "pending")
        .count()
    )
    scores = (
        db.query(CandidateProfile.total_score)
        .filter(CandidateProfile.job_id.in_(user_job_ids), CandidateProfile.total_score > 0)
        .all()
    )
    avg_score = round(sum(s[0] for s in scores) / len(scores), 1) if scores else 0.0

    return {
        "data": {
            "total_resumes": total_resumes,
            "shortlisted": shortlisted,
            "avg_match_score": avg_score,
            "pending_review": pending_review,
        }
    }
