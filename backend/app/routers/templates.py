from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.interview import InterviewTemplate
from app.models.user import User
from app.schemas.interview import SaveTemplateRequest, TemplateOut
from app.utils.auth import get_current_user
from typing import Optional

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.post("", response_model=dict, status_code=201)
def save_template(
    body: SaveTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a question bank as a reusable template tagged by job role."""
    template = InterviewTemplate(
        created_by=current_user.id,
        name=body.name,
        job_role=body.job_role,
        questions=body.questions,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return {"data": TemplateOut.model_validate(template).model_dump()}


@router.get("", response_model=dict)
def list_templates(
    job_role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List templates for the current user, optionally filtered by job_role."""
    query = db.query(InterviewTemplate).filter(
        InterviewTemplate.created_by == current_user.id
    )
    if job_role:
        query = query.filter(InterviewTemplate.job_role.ilike(f"%{job_role}%"))
    templates = query.order_by(InterviewTemplate.created_at.desc()).all()
    return {"data": [TemplateOut.model_validate(t).model_dump() for t in templates]}


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a template — ownership check enforced."""
    template = db.query(InterviewTemplate).filter(
        InterviewTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if str(template.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised to delete this template")
    db.delete(template)
    db.commit()
