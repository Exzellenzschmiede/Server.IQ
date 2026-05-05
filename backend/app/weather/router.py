from fastapi import APIRouter, HTTPException, status

from app.dependencies import get_current_user
from app.models import User
from fastapi import Depends

from .schemas import WeatherData
from .service import get_weather

router = APIRouter()


@router.get("", response_model=WeatherData)
async def weather(_: User = Depends(get_current_user)):
    try:
        return await get_weather()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Weather fetch failed: {e}")
