import type { ActionId } from "./companionEngine";
import type {
  CharacterId,
  SceneId,
} from "./companionState";

export interface CharacterConfig {
  id: CharacterId;
  label: string;
  description: string;
  kind: "kit" | "glb" | "vrm" | "image";
  modelPath: string | null;
  supportedActions: ActionId[];
  scale: number;
  yOffset: number;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
}

export interface SceneConfig {
  id: SceneId;
  label: string;
  description: string;
}

export const CHARACTERS: Record<CharacterId, CharacterConfig> = {
  SUNNY_HUMAN: {
    id: "SUNNY_HUMAN",
    label: "小雅 · 森语",
    description: "使用完整骨骼动画与自然站姿的森语陪伴形态。",
    kind: "kit",
    modelPath: "/models/companion/Xiaoning.glb",
    supportedActions: ["IDLE", "JUMP", "DANCE", "WAVE", "PUNCH", "SIT"],
    scale: 1,
    yOffset: 0,
    cameraPosition: [0, 1.75, 5.8],
    cameraTarget: [0, 1.25, 0],
  },
  KAYKIT_ROGUE_HOODED: {
    id: "KAYKIT_ROGUE_HOODED",
    label: "小雅 · 暮行",
    description: "带有兜帽的暮行人形，沿用同一套完整骨骼动作。",
    kind: "kit",
    modelPath: "/models/companion/Xiaoning_RogueHooded.glb",
    supportedActions: ["IDLE", "JUMP", "DANCE", "WAVE", "PUNCH", "SIT"],
    scale: 1,
    yOffset: 0,
    cameraPosition: [0, 1.75, 5.8],
    cameraTarget: [0, 1.25, 0],
  },
  KAYKIT_MAGE: {
    id: "KAYKIT_MAGE",
    label: "小雅 · 星辉",
    description: "带有法师帽与披风的星辉人形，动作与其他形态一致。",
    kind: "kit",
    modelPath: "/models/companion/Xiaoning_Mage.glb",
    supportedActions: ["IDLE", "JUMP", "DANCE", "WAVE", "PUNCH", "SIT"],
    scale: 1,
    yOffset: 0,
    cameraPosition: [0, 1.75, 5.8],
    cameraTarget: [0, 1.25, 0],
  },
  KAYKIT_RANGER: {
    id: "KAYKIT_RANGER",
    label: "小雅 · 风行",
    description: "背着箭袋的风行人形，适合轻快的户外陪伴。",
    kind: "kit",
    modelPath: "/models/companion/Xiaoning_Ranger.glb",
    supportedActions: ["IDLE", "JUMP", "DANCE", "WAVE", "PUNCH", "SIT"],
    scale: 1,
    yOffset: 0,
    cameraPosition: [0, 1.75, 5.8],
    cameraTarget: [0, 1.25, 0],
  },
  ROBOT_EXPRESSIVE: {
    id: "ROBOT_EXPRESSIVE",
    label: "小雅 · 机械体",
    description: "会呼吸、挥手和跟随视线的小型陪伴机器人。",
    kind: "glb",
    modelPath: "/models/RobotExpressive.glb",
    supportedActions: ["IDLE", "JUMP", "DANCE", "WAVE", "PUNCH", "SIT"],
    scale: 0.9,
    yOffset: -0.16,
    cameraPosition: [0, 2.55, 11.2],
    cameraTarget: [0, 2.35, 0],
  },
  CUSTOM_IMAGE: {
    id: "CUSTOM_IMAGE",
    label: "自定义形象",
    description: "上传静态图片作为轻量角色形象，不转换为 3D 模型。",
    kind: "image",
    modelPath: null,
    supportedActions: ["IDLE"],
    scale: 1,
    yOffset: 0,
    cameraPosition: [0, 1, 4],
    cameraTarget: [0, 1, 0],
  },
};

export const SCENES: Record<SceneId, SceneConfig> = {
  BEACH: {
    id: "BEACH",
    label: "海滩",
    description: "低饱和海风与暖色地平线。",
  },
  MEADOW: {
    id: "MEADOW",
    label: "草地",
    description: "柔和日光与开阔草地。",
  },
  FOREST: {
    id: "FOREST",
    label: "森林",
    description: "深绿层次与安静林间光。",
  },
  SPACE: {
    id: "SPACE",
    label: "太空",
    description: "深蓝星空与低重力氛围。",
  },
};

export function canCharacterUseAction(
  characterId: CharacterId,
  action: ActionId,
): boolean {
  return CHARACTERS[characterId].supportedActions.includes(action);
}

