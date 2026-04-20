from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime


class JobCreate(BaseModel):
    title: str
    description: Optional[str] = None
    required_skills: list = []
    nice_to_have_skills: list = []
    scoring_weights: dict = {
        "skills_match": 0.35,
        "experience": 0.25,
        "education": 0.15,
        "certifications": 0.10,
        "projects": 0.10,
        "completeness": 0.05,
    }


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[list] = None
    nice_to_have_skills: Optional[list] = None
    scoring_weights: Optional[dict] = None
    status: Optional[str] = None


class JobOut(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str]
    required_skills: list
    nice_to_have_skills: list
    scoring_weights: dict
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class JobStats(BaseModel):
    job_id: str
    total_applicants: int
    avg_match_score: float
    shortlisted: int
    pending: int
    rejected: int
    shortlist_rate: float
