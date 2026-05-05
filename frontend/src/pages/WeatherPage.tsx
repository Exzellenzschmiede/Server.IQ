import { useEffect, useState } from "react";
import { getWeather } from "../api/weather";
import type { WeatherData } from "../api/weather";
import Spinner from "../components/ui/Spinner";

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, { weekday: "long" });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-700/30 rounded-xl px-4 py-3 text-center">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

export default function WeatherPage() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { setData(await getWeather()); }
    catch { setError("Could not load weather data. The server may not have internet access."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

  if (error || !data) {
    return (
      <div className="p-4 md:p-6 max-w-2xl space-y-4">
        <h1 className="text-xl font-bold">Weather</h1>
        <div className="card py-12 text-center space-y-2">
          <p className="text-3xl">🌐</p>
          <p className="text-slate-400 text-sm">{error || "No data"}</p>
          <button onClick={load} className="btn-ghost text-xs mt-2">Retry</button>
        </div>
      </div>
    );
  }

  const { current, daily, city, country, timezone } = data;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Weather</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Server location · {city}, {country} · {timezone}
          </p>
        </div>
        <button onClick={load} className="btn-ghost px-3 py-2 text-sm">↻ Refresh</button>
      </div>

      {/* Current conditions */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-end gap-3">
              <span className="text-6xl font-light text-slate-100">{current.temperature}°</span>
              <span className="text-4xl mb-1">{current.icon}</span>
            </div>
            <p className="text-slate-400 mt-1">{current.description}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="text-lg font-semibold text-slate-300">{city}</p>
            <p>{country}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Feels like"   value={`${current.feels_like}°C`} />
          <StatCard label="Humidity"     value={`${current.humidity}%`} />
          <StatCard label="Wind"         value={`${current.wind_speed} km/h`} />
          <StatCard label="Precipitation" value={`${current.precipitation} mm`} />
        </div>
      </div>

      {/* 7-day forecast */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3">7-Day Forecast</h2>
        <div className="card divide-y divide-slate-700/50">
          {daily.map((day, i) => (
            <div key={day.date} className="flex items-center justify-between py-2.5 px-1 gap-4">
              <div className="w-28 shrink-0">
                <p className={`text-sm font-medium ${i === 0 ? "text-indigo-300" : "text-slate-300"}`}>
                  {dayLabel(day.date, i)}
                </p>
                <p className="text-[11px] text-slate-500">{day.date}</p>
              </div>
              <span className="text-2xl shrink-0">{day.icon}</span>
              <p className="flex-1 text-xs text-slate-400 hidden sm:block">{day.description}</p>
              <div className="flex items-center gap-3 text-sm shrink-0">
                <span className="text-slate-200 font-medium">{day.temp_max}°</span>
                <span className="text-slate-500">{day.temp_min}°</span>
              </div>
              {day.precipitation_sum > 0 && (
                <span className="text-xs text-blue-400 shrink-0">💧 {day.precipitation_sum} mm</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-slate-600 text-center">
        Data from Open-Meteo · Location detected from server IP · Cached 30 min
      </p>
    </div>
  );
}
