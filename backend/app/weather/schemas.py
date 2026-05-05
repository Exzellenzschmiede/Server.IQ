from pydantic import BaseModel


class CurrentWeather(BaseModel):
    temperature: float
    feels_like: float
    humidity: int
    wind_speed: float
    precipitation: float
    weather_code: int
    description: str
    icon: str


class DailyForecast(BaseModel):
    date: str
    temp_max: float
    temp_min: float
    weather_code: int
    description: str
    icon: str
    precipitation_sum: float


class WeatherData(BaseModel):
    city: str
    country: str
    latitude: float
    longitude: float
    timezone: str
    current: CurrentWeather
    daily: list[DailyForecast]
