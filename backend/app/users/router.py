import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import hash_password
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import User
from app.users.schemas import (
    GeneratedPassword,
    PasswordResetRequest,
    UserCreate,
    UserResponse,
    UserUpdate,
)

router = APIRouter()

_PASSWORD_ALPHABET = string.ascii_letters + string.digits + "!@#$%^&*"


def _generate_password(length: int = 16) -> str:
    while True:
        pwd = "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(length))
        # Ensure at least one of each required character class
        if (
            any(c.isupper() for c in pwd)
            and any(c.islower() for c in pwd)
            and any(c.isdigit() for c in pwd)
            and any(c in "!@#$%^&*" for c in pwd)
        ):
            return pwd


@router.get("/generate-password", response_model=GeneratedPassword)
async def generate_password(_: User = Depends(require_admin)):
    return GeneratedPassword(password=_generate_password())


@router.get("", response_model=list[UserResponse])
async def list_users(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.scalar(select(User).where(User.email == body.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
    user = User(
        name=body.name,
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Admins can view any user; regular users only themselves
    if current_user.role.value != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UserUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if body.email and body.email.lower() != user.email:
        existing = await db.scalar(select(User).where(User.email == body.email.lower()))
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value.lower() if field == "email" else value)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/reset-password", response_model=UserResponse)
async def reset_password(
    user_id: int,
    body: PasswordResetRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.password_hash = hash_password(body.password)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await db.delete(user)
    await db.commit()
