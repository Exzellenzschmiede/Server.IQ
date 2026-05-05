import time
from typing import Any

import httpx

from .schemas import CurrentWeather, DailyForecast, WeatherData

# WMO weather interpretation codes → (description, emoji)
_WMO: dict[int, tuple[str, str]] = {
    0:  ("Clear sky",              "☀️"),
    1:  ("Mainly clear",           "🌤"),
    2:  ("Partly cloudy",          "⛅"),
    3:  ("Overcast",               "☁️"),
    45: ("Fog",                    "🌫"),
    48: ("Icy fog",                "🌫"),
    51: ("Light drizzle",          "🌦"),
    53: ("Drizzle",                "🌦"),
    55: ("Heavy drizzle",          "🌧"),
    61: ("Light rain",             "🌧"),
    63: ("Rain",                   "🌧"),
    65: ("Heavy rain",             "🌧"),
    71: ("Light snow",             "🌨"),
    73: ("Snow",                   "❄️"),
    75: ("Heavy snow",             "❄️"),
    77: ("Snow grains",            "🌨"),
    80: ("Rain showers",           "🌦"),
    81: ("Rain showers",           "🌧"),
    82: ("Heavy rain showers",     "🌧"),
    85: ("Snow showers",           "🌨"),
    86: ("Heavy snow showers",     "❄️"),
    95: ("Thunderstorm",           "⛈"),
    96: ("Thunderstorm with hail", "⛈"),
    99: ("Thunderstorm with hail", "⛈"),
}

_CACHE: dict[str, Any] = {}
_CACHE_TTL = 1800  # 30 minutes


def _wmo(code: int) -> tuple[str, str]:
    return _WMO.get(code, ("Unknown", "🌡"))


async def get_weather() -> WeatherData:
    now = time.time()
    cached = _CACHE.get("data")
    if cached and now - _CACHE.get("ts", 0) < _CACHE_TTL:
        return cached

    async with httpx.AsyncClient(timeout=10) as client:
        # Geo-locate the server's public IP
        geo_r = await client.get("http://ip-api.com/json/")
        geo_r.raise_for_status()
        geo: dict = geo_r.json()
        lat: float = geo["lat"]
        lon: float = geo["lon"]
        city: str = geo.get("city", "Unknown")
        country: str = geo.get("country", "")

        # Fetch forecast from Open-Meteo (free, no API key)
        wx_r = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current": (
                    "temperature_2m,apparent_temperature,relative_humidity_2m,"
                    "wind_speed_10m,precipitation,weather_code"
                ),
                "daily": (
                    "temperature_2m_max,temperature_2m_min,"
                    "weather_code,precipitation_sum"
                ),
                "timezone": "auto",
                "forecast_days": 7,
            },
        )
        wx_r.raise_for_status()
        wx: dict = wx_r.json()

    cur = wx["current"]
    desc, icon = _wmo(cur["weather_code"])
    current = CurrentWeather(
        temperature=round(cur["temperature_2m"], 1),
        feels_like=round(cur["apparent_temperature"], 1),
        humidity=int(cur["relative_humidity_2m"]),
        wind_speed=round(cur["wind_speed_10m"], 1),
        precipitation=round(cur["precipitation"], 1),
        weather_code=cur["weather_code"],
        description=desc,
        icon=icon,
    )

    daily_raw = wx["daily"]
    daily: list[DailyForecast] = []
    for i, date in enumerate(daily_raw["time"]):
        d, ic = _wmo(daily_raw["weather_code"][i])
        daily.append(DailyForecast(
            date=date,
            temp_max=round(daily_raw["temperature_2m_max"][i], 1),
            temp_min=round(daily_raw["temperature_2m_min"][i], 1),
            weather_code=daily_raw["weather_code"][i],
            description=d,
            icon=ic,
            precipitation_sum=round(daily_raw["precipitation_sum"][i] or 0, 1),
        ))

    result = WeatherData(
        city=city,
        country=country,
        latitude=lat,
        longitude=lon,
        timezone=wx.get("timezone", ""),
        current=current,
        daily=daily,
    )
    _CACHE["data"] = result
    _CACHE["ts"] = now
    return result
