import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SceneHabitat, WeatherLayer } from "./SceneHabitat";

describe("SceneHabitat", () => {
  it("renders the active scene with interactive habitat layers", () => {
    render(
      <SceneHabitat
        sceneId="FOREST"
        emotion="SAD"
        lighting="NIGHT"
        reducedMotion={false}
      />,
    );

    const scene = screen.getByTestId("scene-habitat");
    expect(scene).toHaveAttribute("data-scene", "FOREST");
    expect(scene).toHaveAttribute("data-emotion", "SAD");
    expect(scene).toHaveAttribute("data-lighting", "NIGHT");
    expect(scene).toHaveAccessibleName("森林动态场景");
    expect(scene.querySelectorAll(".scene-cloud").length).toBeGreaterThan(0);
    expect(scene.querySelectorAll(".scene-particle").length).toBeGreaterThan(0);
  });

  it("switches scene identity without changing emotion", () => {
    const { rerender } = render(
      <SceneHabitat
        sceneId="MEADOW"
        emotion="HAPPY"
        lighting="AUTO"
        reducedMotion={false}
      />,
    );

    rerender(
      <SceneHabitat
        sceneId="SPACE"
        emotion="HAPPY"
        lighting="AUTO"
        reducedMotion={false}
      />,
    );

    expect(screen.getByTestId("scene-habitat")).toHaveAttribute(
      "data-scene",
      "SPACE",
    );
    expect(screen.getByTestId("scene-habitat")).toHaveAttribute(
      "data-emotion",
      "HAPPY",
    );
  });

  it("renders live time and weather layers", () => {
    render(
      <>
        <SceneHabitat
          sceneId="BEACH"
          emotion="IDLE"
          lighting="AUTO"
          reducedMotion={false}
          dayPhase="DUSK"
          weather={{
            kind: "RAIN",
            label: "有雨",
            temperatureC: 22,
            isDay: true,
            fetchedAt: 100,
          }}
        />
        <WeatherLayer
          weather={{
            kind: "RAIN",
            label: "有雨",
            temperatureC: 22,
            isDay: true,
            fetchedAt: 100,
          }}
          reducedMotion={false}
        />
      </>,
    );

    const scene = screen.getByTestId("scene-habitat");
    expect(scene).toHaveAttribute("data-day-phase", "DUSK");
    expect(scene).toHaveAttribute("data-weather", "RAIN");
    expect(
      screen.getByTestId("weather-layer").querySelectorAll(".weather-rain"),
    ).toHaveLength(30);
  });
});
