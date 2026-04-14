from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid
from datetime import datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "recruiter"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: Optional[str]
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}
