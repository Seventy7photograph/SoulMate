import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanionPrototype } from "./CompanionPrototype";

describe("CompanionPrototype pointer gaze", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      right: 800,
      bottom: 600,
      left: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves eyes and head toward the pointer", () => {
    render(
      <CompanionPrototype
        emotion="IDLE"
        action="IDLE"
        reply="我在听。"
        lighting="AUTO"
        sceneId="MEADOW"
        characterId="ROBOT_EXPRESSIVE"
        displayName="小雅"
        accentColor="#ef8c24"
        customImageDataUrl={null}
        imageZoom={1}
      />,
    );
    const stage = screen.getByTestId("companion-stage");

    fireEvent.pointerMove(window, { clientX: 760, clientY: 60 });

    expect(Number(stage.style.getPropertyValue("--gaze-x"))).toBeGreaterThan(0);
    expect(Number(stage.style.getPropertyValue("--gaze-y"))).toBeLessThan(0);
    expect(stage.style.getPropertyValue("--eye-x")).not.toBe("0px");
    expect(stage.style.getPropertyValue("--head-x")).not.toBe("0px");
  });

  it("returns the gaze to neutral when the pointer leaves", () => {
    render(
      <CompanionPrototype
        emotion="IDLE"
        action="IDLE"
        reply="我在听。"
        lighting="AUTO"
        sceneId="MEADOW"
        characterId="ROBOT_EXPRESSIVE"
        displayName="小雅"
        accentColor="#ef8c24"
        customImageDataUrl={null}
        imageZoom={1}
      />,
    );
    const stage = screen.getByTestId("companion-stage");

    fireEvent.pointerMove(window, { clientX: 760, clientY: 60 });
    fireEvent.pointerLeave(document.documentElement);

    expect(Number(stage.style.getPropertyValue("--gaze-x"))).toBe(0);
    expect(Number(stage.style.getPropertyValue("--gaze-y"))).toBe(0);
    expect(parseFloat(stage.style.getPropertyValue("--eye-x"))).toBe(0);
    expect(parseFloat(stage.style.getPropertyValue("--head-x"))).toBe(0);
  });

  it("offers visible rotate and reset alternatives to dragging", () => {
    render(
      <CompanionPrototype
        emotion="IDLE"
        action="IDLE"
        reply="我在听。"
        lighting="AUTO"
        sceneId="MEADOW"
        characterId="ROBOT_EXPRESSIVE"
        displayName="小雅"
        accentColor="#ef8c24"
        customImageDataUrl={null}
        imageZoom={1}
      />,
    );

    expect(
      screen.getByRole("button", { name: "向左旋转角色" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "向右旋转角色" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重置角色视角" }),
    ).toBeInTheDocument();
  });

  it("grounds the sit action with a rest cushion and sleepy motes", () => {
    render(
      <CompanionPrototype
        emotion="SLEEPY"
        action="SIT"
        reply=""
        lighting="AUTO"
        sceneId="MEADOW"
        characterId="ROBOT_EXPRESSIVE"
        displayName="小雅"
        accentColor="#ef8c24"
        customImageDataUrl={null}
        imageZoom={1}
      />,
    );

    expect(screen.getByTestId("rest-cushion")).toBeInTheDocument();
    expect(screen.getByTestId("sleep-motes")).toBeInTheDocument();
  });
});

