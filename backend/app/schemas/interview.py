from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime


class GenerateQuestionsRequest(BaseModel):
    profile_id: uuid.UUID
    job_id: uuid.UUID


class QuestionBankOut(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    candidate_profile_id: uuid.UUID
    questions: list
    generated_at: datetime

    model_config = {"from_attributes": True}


class StartSessionRequest(BaseModel):
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    question_bank_id: uuid.UUID
    mode: str = "practice"


class SessionOut(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    status: str
    mode: str
    overall_score: Optional[float]
    started_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SubmitAnswerRequest(BaseModel):
    question_id: str
    answer_text: str


class AnswerOut(BaseModel):
    relevance_score: Optional[float]
    clarity_score: Optional[float]
    depth_score: Optional[float]
    confidence_score: Optional[float]
    structure_score: Optional[float]
    feedback: dict

    model_config = {"from_attributes": True}


class SessionReportOut(BaseModel):
    session_id: uuid.UUID
    overall_score: Optional[float]
    status: str
    feedback_summary: dict
    answers: List[dict]
