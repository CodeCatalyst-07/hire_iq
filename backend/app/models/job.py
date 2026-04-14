import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text, DateTime, ForeignKey, func, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    required_skills: Mapped[list] = mapped_column(ARRAY(String), default=list)
    nice_to_have_skills: Mapped[list] = mapped_column(ARRAY(String), default=list)
    scoring_weights: Mapped[dict] = mapped_column(JSONB, default=lambda: {
        "skills_match": 0.35,
        "experience": 0.25,
        "education": 0.15,
        "certifications": 0.10,
        "projects": 0.10,
        "completeness": 0.05,
    })
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    candidate_profiles: Mapped[List["CandidateProfile"]] = relationship("CandidateProfile", back_populates="job")  # type: ignore
