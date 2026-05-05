import client from "./client";

export interface CurrentWeather {
  temperature: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  precipitation: number;
  weather_code: number;
  description: string;
  icon: string;
}

export interface DailyForecast {
  date: string;
  temp_max: number;
  temp_min: number;
  weather_code: number;
  description: string;
  icon: string;
  precipitation_sum: number;
}

export interface WeatherData {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  current: CurrentWeather;
  daily: DailyForecast[];
}

export const getWeather = async (): Promise<WeatherData> => {
  const { data } = await client.get<WeatherData>("/weather");
  return data;
};
