import { describe, expect, it } from "vitest";
import {
  KAYKIT_CHARACTERS,
  KAYKIT_COMPANION,
  resolveKayKitClip,
} from "./kayKitCompanion";

describe("KayKit companion manifest", () => {
  it("publishes a local animated humanoid and its CC0 clip sources", () => {
    expect(KAYKIT_COMPANION.modelPath).toBe(
      "/models/companion/Xiaoning.glb",
    );
    expect(KAYKIT_COMPANION.animationFiles).toContain(
      "/models/companion/Rig_Medium_Simulation.glb",
    );
    expect(KAYKIT_COMPANION.license).toContain("CC0");
  });

  it("publishes four same-rig humanoid forms", () => {
    expect(Object.keys(KAYKIT_CHARACTERS)).toEqual([
      "SUNNY_HUMAN",
      "KAYKIT_ROGUE_HOODED",
      "KAYKIT_MAGE",
      "KAYKIT_RANGER",
    ]);
    expect(
      new Set(
        Object.values(KAYKIT_CHARACTERS).map((profile) =>
          profile.modelPath,
        ),
      ).size,
    ).toBe(4);
  });

  it("maps companion actions to real KayKit clips", () => {
    const clips = new Set(KAYKIT_COMPANION.clipNames);

    expect(resolveKayKitClip("SIT", clips)).toBe("Sit_Floor_Idle");
    expect(resolveKayKitClip("WAVE", clips)).toBe("Waving");
    expect(resolveKayKitClip("PUNCH", clips)).toBe(
      "Melee_Unarmed_Attack_Punch_A",
    );
    expect(resolveKayKitClip("JUMP", clips)).toBe("Jump_Full_Short");
  });

  it("uses a softer idle for happy emotion and falls back safely", () => {
    const clips = new Set(KAYKIT_COMPANION.clipNames);

    expect(resolveKayKitClip("HAPPY", clips)).toBe("Idle_B");
    expect(resolveKayKitClip("DANCE", new Set(["Idle_A"]))).toBe("Idle_A");
  });
});
