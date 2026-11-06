import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  SCENES,
  canCharacterUseAction,
} from "./characterConfig";

describe("character and scene configuration", () => {
  it("defines four humanoid companions, the robot, and custom image mode", () => {
    expect(CHARACTERS.ROBOT_EXPRESSIVE.modelPath).toBe(
      "/models/RobotExpressive.glb",
    );
    expect(CHARACTERS.SUNNY_HUMAN.modelPath).toBe(
      "/models/companion/Xiaoning.glb",
    );
    expect(CHARACTERS.KAYKIT_ROGUE_HOODED.modelPath).toBe(
      "/models/companion/Xiaoning_RogueHooded.glb",
    );
    expect(CHARACTERS.KAYKIT_MAGE.modelPath).toBe(
      "/models/companion/Xiaoning_Mage.glb",
    );
    expect(CHARACTERS.KAYKIT_RANGER.modelPath).toBe(
      "/models/companion/Xiaoning_Ranger.glb",
    );
    expect(CHARACTERS.CUSTOM_IMAGE.kind).toBe("image");
  });

  it("defines four independent scenes", () => {
    expect(Object.keys(SCENES)).toEqual([
      "BEACH",
      "MEADOW",
      "FOREST",
      "SPACE",
    ]);
  });

  it("limits custom images to idle and allows the humanoid rig to wave", () => {
    expect(canCharacterUseAction("CUSTOM_IMAGE", "PUNCH")).toBe(false);
    expect(canCharacterUseAction("CUSTOM_IMAGE", "IDLE")).toBe(true);
    expect(canCharacterUseAction("SUNNY_HUMAN", "WAVE")).toBe(true);
    expect(canCharacterUseAction("ROBOT_EXPRESSIVE", "PUNCH")).toBe(true);
  });
});

