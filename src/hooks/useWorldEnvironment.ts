import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clearWeather,
  getDayPhase,
  weatherFromCode,
  type EnvironmentMode,
  type WeatherSnapshot,
} from "../domain/environment";

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
}

export function useWorldEnvironment() {
  const [mode, setMode] = useState<EnvironmentMode>("MANUAL");
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] =
    useState<WeatherSnapshot>(clearWeather);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const weatherRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshWeather = useCallback(async () => {
    if (!navigator.geolocation) {
      setStatus("当前浏览器不支持定位");
      return;
    }
    weatherRequest.current?.abort();
    const controller = new AbortController();
    weatherRequest.current = controller;
    setLoading(true);
    setStatus("正在获取当地天气");

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8_000,
            maximumAge: 15 * 60_000,
          });
        },
      );
      const params = new URLSearchParams({
        latitude: position.coords.latitude.toFixed(4),
        longitude: position.coords.longitude.toFixed(4),
        current: "temperature_2m,weather_code,is_day",
        timezone: "auto",
      });
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        throw new Error(`Weather request failed: ${response.status}`);
      }
      const payload = (await response.json()) as OpenMeteoResponse;
      const code = payload.current?.weather_code;
      if (typeof code !== "number") {
        throw new Error("Weather response is incomplete");
      }
      const condition = weatherFromCode(code);
      setWeather({
        ...condition,
        temperatureC:
          typeof payload.current?.temperature_2m === "number"
            ? Math.round(payload.current.temperature_2m)
            : null,
        isDay: payload.current?.is_day !== 0,
        fetchedAt: Date.now(),
      });
      setNow(new Date());
      setStatus("当地天气已同步");
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }
      setWeather(clearWeather);
      setStatus("天气暂不可用，已使用晴朗场景");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (mode !== "WEATHER") {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void refreshWeather();
    }, 15 * 60_000);
    return () => window.clearInterval(timer);
  }, [mode, refreshWeather]);

  useEffect(
    () => () => {
      weatherRequest.current?.abort();
    },
    [],
  );

  const enableTime = useCallback(() => {
    setMode((current) => {
      if (current === "TIME") {
        setStatus("");
        return "MANUAL";
      }
      setNow(new Date());
      setStatus("已跟随系统时间");
      return "TIME";
    });
  }, []);

  const enableWeather = useCallback(() => {
    setMode((current) => {
      if (current === "WEATHER") {
        setStatus("");
        return "MANUAL";
      }
      void refreshWeather();
      return "WEATHER";
    });
  }, [refreshWeather]);

  return {
    mode,
    dayPhase: mode === "MANUAL" ? "DAY" : getDayPhase(now),
    weather: mode === "WEATHER" ? weather : clearWeather,
    status,
    loading,
    enableTime,
    enableWeather,
    refreshWeather,
  };
}
