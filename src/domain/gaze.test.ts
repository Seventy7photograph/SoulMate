import { describe, expect, it } from "vitest";
import { normalizePointer } from "./gaze";

describe("pointer gaze math", () => {
  it("maps the stage center to neutral gaze", () => {
    expect(
      normalizePointer(400, 300, {
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
    ).toEqual({ x: 0, y: 0 });
  });

  it("clamps pointer positions outside the stage", () => {
    expect(
      normalizePointer(1200, -400, {
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
    ).toEqual({ x: 1, y: -1 });
  });
});

