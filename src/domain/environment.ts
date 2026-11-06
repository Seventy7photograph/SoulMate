export type EnvironmentMode = "MANUAL" | "TIME" | "WEATHER";
export type DayPhase = "DAWN" | "DAY" | "DUSK" | "NIGHT";
export type WeatherKind =
  | "CLEAR"
  | "PARTLY_CLOUDY"
  | "CLOUDY"
  | "RAIN"
  | "SNOW"
  | "FOG";

export interface WeatherSnapshot {
  kind: WeatherKind;
  label: string;
  temperatureC: number | null;
  isDay: boolean;
  fetchedAt: number;
}

export const clearWeather: WeatherSnapshot = {
  kind: "CLEAR",
  label: "晴朗",
  temperatureC: null,
  isDay: true,
  fetchedAt: 0,
};

export function getDayPhase(date: Date): DayPhase {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour >= 5 && hour < 8) {
    return "DAWN";
  }
  if (hour >= 8 && hour < 17) {
    return "DAY";
  }
  if (hour >= 17 && hour < 20) {
    return "DUSK";
  }
  return "NIGHT";
}

export function weatherFromCode(code: number): {
  kind: WeatherKind;
  label: string;
} {
  if ([0].includes(code)) {
    return { kind: "CLEAR", label: "晴朗" };
  }
  if ([1, 2].includes(code)) {
    return { kind: "PARTLY_CLOUDY", label: "晴间多云" };
  }
  if ([3].includes(code)) {
    return { kind: "CLOUDY", label: "多云" };
  }
  if ([45, 48].includes(code)) {
    return { kind: "FOG", label: "有雾" };
  }
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99)
  ) {
    return { kind: "RAIN", label: "有雨" };
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return { kind: "SNOW", label: "有雪" };
  }
  return { kind: "CLOUDY", label: "多云" };
}
