// Free weather forecast via open-meteo (no API key, CORS-enabled).
export interface RaceWeather {
  tempMax: number;
  tempMin: number;
  windMax: number;
  code: number;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Daily forecast for the race location & date. open-meteo only forecasts ~16
 * days ahead, so returns null for past races or dates beyond the window.
 */
export async function getRaceWeather(
  lat: number,
  lon: number,
  isoDate: string,
): Promise<RaceWeather | null> {
  const date = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 15);

  if (date < today || date > horizon) return null;

  const day = ymd(date);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max` +
    `&start_date=${day}&end_date=${day}&timezone=auto`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.daily;
    if (!d || !d.temperature_2m_max?.length) return null;
    return {
      tempMax: Math.round(d.temperature_2m_max[0]),
      tempMin: Math.round(d.temperature_2m_min[0]),
      windMax: Math.round(d.wind_speed_10m_max[0]),
      code: d.weather_code[0],
    };
  } catch {
    return null;
  }
}

/** WMO weather code → Ionicons name. */
export function weatherIcon(code: number): string {
  if (code === 0) return 'sunny';
  if (code <= 2) return 'partly-sunny';
  if (code === 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'cloud';
  if (code >= 51 && code <= 67) return 'rainy';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rainy';
  if (code >= 95) return 'thunderstorm';
  return 'partly-sunny';
}
