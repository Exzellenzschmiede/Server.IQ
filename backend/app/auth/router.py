from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import (
    LoginRequest,
    RefreshRequest,
    SetupRequest,
    SetupStatusResponse,
    TokenResponse,
    UserInfo,
)
from app.auth.service import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserRole

router = APIRouter()


@router.get("/setup", response_model=SetupStatusResponse)
async def setup_status(db: AsyncSession = Depends(get_db)):
    count = await db.scalar(select(func.count()).select_from(User))
    return SetupStatusResponse(setup_required=count == 0)


@router.post("/setup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def create_admin(body: SetupRequest, db: AsyncSession = Depends(get_db)):
    count = await db.scalar(select(func.count()).select_from(User))
    if count > 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Setup already completed")
    user = User(
        name=body.name,
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        role=UserRole.admin,
    )
    db.add(user)
    await db.commit()
    return TokenResponse(
        access_token=create_access_token(user.email),
        refresh_token=create_refresh_token(user.email),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.lower(), User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(
        access_token=create_access_token(user.email),
        refresh_token=create_refresh_token(user.email),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    email: str = payload.get("sub")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return TokenResponse(
        access_token=create_access_token(user.email),
        refresh_token=create_refresh_token(user.email),
    )


@router.get("/me", response_model=UserInfo)
async def me(current_user: User = Depends(get_current_user)):
    return UserInfo(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role.value,
        is_admin=current_user.role == UserRole.admin,
    )
