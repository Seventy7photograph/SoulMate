import { describe, expect, it } from "vitest";
import {
  ROBOT_MODEL,
  resolveAnimationClip,
} from "./modelManifest";

describe("RobotExpressive model manifest", () => {
  it("declares the verified local model and required clips", () => {
    expect(ROBOT_MODEL.path).toBe("/models/RobotExpressive.glb");
    expect(ROBOT_MODEL.clips).toContain("Idle");
    expect(ROBOT_MODEL.clips).toContain("Jump");
    expect(ROBOT_MODEL.clips).toContain("Sitting");
    expect(ROBOT_MODEL.morphTargets).toEqual([
      "Angry",
      "Surprised",
      "Sad",
    ]);
  });

  it("resolves a semantic action to a verified clip", () => {
    expect(resolveAnimationClip("HAPPY", new Set(ROBOT_MODEL.clips))).toBe(
      "Dance",
    );
    expect(resolveAnimationClip("SLEEPY", new Set(ROBOT_MODEL.clips))).toBe(
      "Idle",
    );
    expect(resolveAnimationClip("SIT", new Set(ROBOT_MODEL.clips))).toBe(
      "Sitting",
    );
  });

  it("falls back to Idle when a requested clip is unavailable", () => {
    expect(resolveAnimationClip("ANGRY", new Set(["Idle"]))).toBe("Idle");
  });
});

