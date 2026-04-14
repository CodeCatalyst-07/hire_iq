import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text, DateTime, ForeignKey, Numeric, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    location: Mapped[Optional[str]] = mapped_column(String(255))
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500))
    github_url: Mapped[Optional[str]] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(100), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profiles: Mapped[List["CandidateProfile"]] = relationship("CandidateProfile", back_populates="candidate")


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    raw_resume_url: Mapped[Optional[str]] = mapped_column(String(1000))
    parsed_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    total_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    score_breakdown: Mapped[dict] = mapped_column(JSONB, default=dict)
    skill_match_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    experience_years: Mapped[float] = mapped_column(Numeric(4, 1), default=0)
    education_level: Mapped[Optional[str]] = mapped_column(String(100))
    parse_status: Mapped[str] = mapped_column(String(50), default="pending")
    parse_confidence: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="profiles")
    job: Mapped["JobPosting"] = relationship("JobPosting", back_populates="candidate_profiles")  # type: ignore
