import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text, DateTime, ForeignKey, Numeric, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class QuestionBank(Base):
    __tablename__ = "question_banks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_postings.id"), nullable=False)
    candidate_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidate_profiles.id"), nullable=False)
    questions: Mapped[list] = mapped_column(JSONB, default=list)
    generation_model: Mapped[str] = mapped_column(String(100), default="gemini-2.0-flash")
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sessions: Mapped[List["InterviewSession"]] = relationship("InterviewSession", back_populates="question_bank")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_postings.id"), nullable=False)
    question_bank_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("question_banks.id"), nullable=False)
    mode: Mapped[str] = mapped_column(String(50), default="practice")
    status: Mapped[str] = mapped_column(String(50), default="pending")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    overall_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    feedback_summary: Mapped[dict] = mapped_column(JSONB, default=dict)

    question_bank: Mapped["QuestionBank"] = relationship("QuestionBank", back_populates="sessions")
    answers: Mapped[List["InterviewAnswer"]] = relationship("InterviewAnswer", back_populates="session")


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[str] = mapped_column(String(50), nullable=False)
    answer_text: Mapped[Optional[str]] = mapped_column(Text)
    relevance_score: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    clarity_score: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    depth_score: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    confidence_score: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    structure_score: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    feedback: Mapped[dict] = mapped_column(JSONB, default=dict)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="answers")


class InterviewTemplate(Base):
    __tablename__ = "interview_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    job_role: Mapped[str] = mapped_column(String(200), nullable=False)
    questions: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
