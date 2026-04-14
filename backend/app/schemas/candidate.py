from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime


class CandidateOut(BaseModel):
    id: uuid.UUID
    name: str
    email: Optional[str]
    phone: Optional[str]
    location: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class CandidateProfileOut(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    total_score: float
    skill_match_pct: float
    experience_years: float
    education_level: Optional[str]
    parse_status: str
    status: str
    parsed_data: dict
    score_breakdown: dict
    created_at: datetime
    candidate: CandidateOut

    model_config = {"from_attributes": True}


class CandidateProfileUpdate(BaseModel):
    status: Optional[str] = None
    parsed_data: Optional[dict] = None


class UploadResponse(BaseModel):
    candidate_id: uuid.UUID
    profile_id: uuid.UUID
    status: str
    message: str
