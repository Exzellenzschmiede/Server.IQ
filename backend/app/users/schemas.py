from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models import UserRole


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    email: EmailStr
    password: str = Field(min_length=8)
    role: UserRole = UserRole.user


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=128)
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class PasswordResetRequest(BaseModel):
    password: str = Field(min_length=8)


class GeneratedPassword(BaseModel):
    password: str
