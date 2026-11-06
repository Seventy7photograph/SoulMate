import type {
  ActionId,
  Emotion,
} from "../domain/companionEngine";
import type { CharacterId } from "../domain/companionState";

export type KayKitCharacterId =
  | "SUNNY_HUMAN"
  | "KAYKIT_ROGUE_HOODED"
  | "KAYKIT_MAGE"
  | "KAYKIT_RANGER";

export interface KayKitCharacterProfile {
  id: KayKitCharacterId;
  label: string;
  description: string;
  modelPath: string;
  targetHeight: number;
  accentColor: string;
}

export const KAYKIT_CHARACTERS: Record<
  KayKitCharacterId,
  KayKitCharacterProfile
> = {
  SUNNY_HUMAN: {
    id: "SUNNY_HUMAN",
    label: "小雅 · 森语",
    description: "轻装灵巧的森语人形，动作完整，适合日常陪伴。",
    modelPath: "/models/companion/Xiaoning.glb",
    targetHeight: 2.35,
    accentColor: "#8fcf9c",
  },
  KAYKIT_ROGUE_HOODED: {
    id: "KAYKIT_ROGUE_HOODED",
    label: "小雅 · 暮行",
    description: "戴兜帽的暮行形态，更安静，也更适合夜间场景。",
    modelPath: "/models/companion/Xiaoning_RogueHooded.glb",
    targetHeight: 2.35,
    accentColor: "#7faea0",
  },
  KAYKIT_MAGE: {
    id: "KAYKIT_MAGE",
    label: "小雅 · 星辉",
    description: "带有法师帽与披风的星辉形态，适合魔法感场景。",
    modelPath: "/models/companion/Xiaoning_Mage.glb",
    targetHeight: 2.52,
    accentColor: "#a99bd8",
  },
  KAYKIT_RANGER: {
    id: "KAYKIT_RANGER",
    label: "小雅 · 风行",
    description: "背着箭袋的风行形态，适合海滩、草地与森林。",
    modelPath: "/models/companion/Xiaoning_Ranger.glb",
    targetHeight: 2.35,
    accentColor: "#d4a66f",
  },
};

export function isKayKitCharacter(
  characterId: CharacterId,
): characterId is KayKitCharacterId {
  return characterId in KAYKIT_CHARACTERS;
}

export function resolveKayKitCharacter(
  characterId: CharacterId,
): KayKitCharacterProfile {
  return isKayKitCharacter(characterId)
    ? KAYKIT_CHARACTERS[characterId]
    : KAYKIT_CHARACTERS.SUNNY_HUMAN;
}

export const KAYKIT_COMPANION = {
  id: "xiaoning-kaykit",
  modelPath: KAYKIT_CHARACTERS.SUNNY_HUMAN.modelPath,
  animationFiles: [
    "/models/companion/Rig_Medium_General.glb",
    "/models/companion/Rig_Medium_MovementBasic.glb",
    "/models/companion/Rig_Medium_Simulation.glb",
    "/models/companion/Rig_Medium_CombatMelee.glb",
  ],
  clipNames: [
    "Idle_A",
    "Idle_B",
    "Interact",
    "PickUp",
    "Use_Item",
    "Throw",
    "Hit_A",
    "Jump_Full_Short",
    "Jump_Land",
    "Jump_Start",
    "Walking_A",
    "Running_A",
    "Cheering",
    "Waving",
    "Sit_Chair_Down",
    "Sit_Chair_Idle",
    "Sit_Chair_StandUp",
    "Sit_Floor_Down",
    "Sit_Floor_Idle",
    "Sit_Floor_StandUp",
    "Melee_Unarmed_Attack_Punch_A",
    "Melee_Unarmed_Attack_Kick",
    "Melee_Unarmed_Idle",
  ],
  ambientClips: ["Idle_B", "Waving", "Interact", "PickUp"],
  loopClips: ["Idle_A", "Idle_B", "Sit_Chair_Idle", "Sit_Floor_Idle"],
  license:
    "KayKit Adventurers and Character Animations by Kay Lousberg, CC0 1.0.",
} as const;

const actionToClip: Record<ActionId, string> = {
  IDLE: "Idle_A",
  JUMP: "Jump_Full_Short",
  DANCE: "Cheering",
  WAVE: "Waving",
  PUNCH: "Melee_Unarmed_Attack_Punch_A",
  SIT: "Sit_Floor_Idle",
};

const emotionToIdleClip: Record<Emotion, string> = {
  IDLE: "Idle_A",
  HAPPY: "Idle_B",
  SHY: "Idle_A",
  SAD: "Idle_A",
  SLEEPY: "Idle_A",
  ANGRY: "Idle_B",
};

export function resolveKayKitClip(
  intent: ActionId | Emotion,
  availableClips: ReadonlySet<string>,
): string {
  const action = actionToClip[intent as ActionId];
  const requested =
    action ?? emotionToIdleClip[intent as Emotion] ?? "Idle_A";
  if (availableClips.has(requested)) {
    return requested;
  }
  return availableClips.has("Idle_A") ? "Idle_A" : "Idle_B";
}
