from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.job import JobPosting
from app.models.candidate import CandidateProfile
from app.models.user import User
from app.schemas.job import JobCreate, JobUpdate, JobOut, JobStats
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=dict)
def list_jobs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    jobs = (
        db.query(JobPosting)
        .filter(JobPosting.created_by == current_user.id, JobPosting.status != "deleted")
        .order_by(JobPosting.created_at.desc())
        .all()
    )
    return {"data": [JobOut.model_validate(j).model_dump() for j in jobs]}


@router.post("", response_model=dict, status_code=201)
def create_job(body: JobCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = JobPosting(
        created_by=current_user.id,
        title=body.title,
        description=body.description,
        required_skills=body.required_skills,
        nice_to_have_skills=body.nice_to_have_skills,
        scoring_weights=body.scoring_weights,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"data": JobOut.model_validate(job).model_dump()}


@router.get("/{job_id}/stats", response_model=dict)
def get_job_stats(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return per-job analytics: applicant counts, avg score, shortlist rate."""
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if str(job.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised to access this job")

    profiles = db.query(CandidateProfile).filter(CandidateProfile.job_id == job_id).all()
    total = len(profiles)
    shortlisted = sum(1 for p in profiles if p.status == "shortlisted")
    pending = sum(1 for p in profiles if p.status == "pending")
    rejected = sum(1 for p in profiles if p.status == "rejected")
    scores = [float(p.total_score) for p in profiles if p.total_score and p.total_score > 0]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    shortlist_rate = round((shortlisted / total) * 100, 1) if total > 0 else 0.0

    stats = JobStats(
        job_id=str(job.id),
        total_applicants=total,
        avg_match_score=avg_score,
        shortlisted=shortlisted,
        pending=pending,
        rejected=rejected,
        shortlist_rate=shortlist_rate,
    )
    return {"data": stats.model_dump()}


@router.get("/{job_id}", response_model=dict)
def get_job(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if str(job.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised to access this job")
    return {"data": JobOut.model_validate(job).model_dump()}


@router.patch("/{job_id}", response_model=dict)
def update_job(job_id: str, body: JobUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if str(job.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised to modify this job")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(job, field, val)
    db.commit()
    db.refresh(job)
    return {"data": JobOut.model_validate(job).model_dump()}


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Soft-delete: set status to 'deleted'."""
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if str(job.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised to delete this job")
    job.status = "deleted"
    db.commit()
