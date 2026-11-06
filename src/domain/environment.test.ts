import { describe, expect, it } from "vitest";
import {
  getDayPhase,
  weatherFromCode,
} from "./environment";

describe("world environment", () => {
  it("derives four day phases from local system time", () => {
    expect(getDayPhase(new Date("2026-11-07T06:30:00"))).toBe("DAWN");
    expect(getDayPhase(new Date("2026-11-07T12:00:00"))).toBe("DAY");
    expect(getDayPhase(new Date("2026-11-07T18:10:00"))).toBe("DUSK");
    expect(getDayPhase(new Date("2026-11-07T23:30:00"))).toBe("NIGHT");
  });

  it("maps common Open-Meteo weather codes to scene effects", () => {
    expect(weatherFromCode(0).kind).toBe("CLEAR");
    expect(weatherFromCode(2).kind).toBe("PARTLY_CLOUDY");
    expect(weatherFromCode(61).kind).toBe("RAIN");
    expect(weatherFromCode(73).kind).toBe("SNOW");
    expect(weatherFromCode(45).kind).toBe("FOG");
  });
});
