import type {
  ActionId,
  Emotion,
  EmotionResult,
} from "./companionEngine";

export type CharacterId =
  | "SUNNY_HUMAN"
  | "KAYKIT_ROGUE_HOODED"
  | "KAYKIT_MAGE"
  | "KAYKIT_RANGER"
  | "ROBOT_EXPRESSIVE"
  | "CUSTOM_IMAGE";

export type SceneId = "BEACH" | "MEADOW" | "FOREST" | "SPACE";
export type LightingPreset = "AUTO" | "WARM" | "NIGHT";
export type EventSource =
  | "USER"
  | "QUICK_ACTION"
  | "DEBUG"
  | "SYSTEM"
  | "AI";
export type EventStatus = "SUCCESS" | "FALLBACK" | "ERROR";
export type EventType =
  | "INTERACTION"
  | "EMOTION_CHANGE"
  | "ACTION_CHANGE"
  | "SCENE_CHANGE"
  | "CHARACTER_CHANGE"
  | "LIGHTING_CHANGE"
  | "SYSTEM_NOTICE"
  | "ERROR";

export type ConversationRole = "USER" | "COMPANION" | "SYSTEM";

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  text: string;
  timestamp: number;
  emotion?: Emotion;
}

export const ACTION_DURATION_MS: Record<ActionId, number> = {
  IDLE: 0,
  JUMP: 900,
  DANCE: 3600,
  WAVE: 2200,
  PUNCH: 1250,
  SIT: 0,
};

export interface CompanionSnapshot {
  emotion: Emotion;
  action: ActionId;
  actionNonce: number;
  reply: string;
  systemNotice: string | null;
  systemInstruction: string;
  messages: ConversationMessage[];
  lighting: LightingPreset;
  sceneId: SceneId;
  characterId: CharacterId;
  revision: number;
  updatedAt: number;
}

export interface CompanionEventDraft {
  source: EventSource;
  type: EventType;
  label: string;
  detail: string;
  previousEmotion?: Emotion;
  nextEmotion?: Emotion;
  previousAction?: ActionId;
  nextAction?: ActionId;
  previousScene?: SceneId;
  nextScene?: SceneId;
  previousCharacter?: CharacterId;
  nextCharacter?: CharacterId;
  sceneId: SceneId;
  characterId: CharacterId;
  durationMs?: number;
  provider?: string;
  status: EventStatus;
}

export type CompanionCommand =
  | {
      type: "APPLY_RESULT";
      result: EmotionResult;
      source: EventSource;
      label: string;
      detail: string;
      durationMs?: number;
      provider?: string;
      status?: EventStatus;
    }
  | { type: "DEBUG_SET_ACTION"; action: ActionId }
  | {
      type: "APPEND_MESSAGE";
      message: ConversationMessage;
    }
  | {
      type: "SET_SYSTEM_INSTRUCTION";
      instruction: string;
    }
  | {
      type: "SETTLE_ACTION";
      expectedActionNonce: number;
    }
  | {
      type: "DEBUG_SET_LIGHTING";
      lighting: LightingPreset;
    }
  | { type: "SET_SCENE"; sceneId: SceneId }
  | { type: "SET_CHARACTER"; characterId: CharacterId }
  | { type: "SHOW_NOTICE"; message: string }
  | { type: "CLEAR_NOTICE" }
  | { type: "RESET" };

export interface CompanionTransition {
  state: CompanionSnapshot;
  event: CompanionEventDraft | null;
}

const initialReply = "我在听。今天想和我聊点什么？";

export function createInitialCompanionState(): CompanionSnapshot {
  return {
    emotion: "IDLE",
    action: "IDLE",
    actionNonce: 0,
    reply: initialReply,
    systemNotice: null,
    systemInstruction: "",
    messages: [
      {
        id: "welcome",
        role: "COMPANION",
        text: initialReply,
        timestamp: Date.now(),
        emotion: "IDLE",
      },
    ],
    lighting: "AUTO",
    sceneId: "MEADOW",
    characterId: "SUNNY_HUMAN",
    revision: 0,
    updatedAt: Date.now(),
  };
}

function commit(
  state: CompanionSnapshot,
  next: Partial<CompanionSnapshot>,
  event: CompanionEventDraft | null,
): CompanionTransition {
  return {
    state: {
      ...state,
      ...next,
      revision: state.revision + 1,
      updatedAt: Date.now(),
    },
    event,
  };
}

export function reduceCompanionState(
  state: CompanionSnapshot,
  command: CompanionCommand,
): CompanionTransition {
  switch (command.type) {
    case "APPLY_RESULT":
      return commit(
        state,
        {
          emotion: command.result.emotion,
          action: command.result.action,
          actionNonce: state.actionNonce + 1,
          reply: command.result.reply,
          systemNotice: null,
          messages: [
            ...state.messages,
            {
              id: `companion-${state.revision + 1}-${Date.now()}`,
              role: "COMPANION" as const,
              text: command.result.reply,
              timestamp: Date.now(),
              emotion: command.result.emotion,
            },
          ].slice(-80),
        },
        {
          source: command.source,
          type: "EMOTION_CHANGE",
          label: command.label,
          detail: command.detail,
          previousEmotion: state.emotion,
          nextEmotion: command.result.emotion,
          previousAction: state.action,
          nextAction: command.result.action,
          sceneId: state.sceneId,
          characterId: state.characterId,
          durationMs: command.durationMs,
          provider: command.provider,
          status: command.status ?? "SUCCESS",
        },
      );

    case "DEBUG_SET_ACTION":
      return commit(
        state,
        {
          action: command.action,
          actionNonce: state.actionNonce + 1,
        },
        {
          source: "DEBUG",
          type: "ACTION_CHANGE",
          label: "DEBUG",
          detail: `强制动作 ${command.action}`,
          previousAction: state.action,
          nextAction: command.action,
          sceneId: state.sceneId,
          characterId: state.characterId,
          status: "SUCCESS",
        },
      );

    case "APPEND_MESSAGE":
      return commit(
        state,
        {
          messages: [...state.messages, command.message].slice(-80),
        },
        null,
      );

    case "SET_SYSTEM_INSTRUCTION": {
      const instruction = command.instruction.trim().slice(0, 500);
      return commit(
        state,
        {
          systemInstruction: instruction,
        },
        {
          source: "DEBUG",
          type: "SYSTEM_NOTICE",
          label: "开发者指令",
          detail: instruction || "已清空开发者指令",
          sceneId: state.sceneId,
          characterId: state.characterId,
          status: "SUCCESS",
        },
      );
    }

    case "SETTLE_ACTION":
      if (command.expectedActionNonce !== state.actionNonce) {
        return { state, event: null };
      }
      return {
        state: {
          ...state,
          action: "IDLE",
          updatedAt: Date.now(),
        },
        event: null,
      };

    case "DEBUG_SET_LIGHTING":
      return commit(
        state,
        {
          lighting: command.lighting,
        },
        {
          source: "DEBUG",
          type: "LIGHTING_CHANGE",
          label: "DEBUG",
          detail: `灯光切换 ${command.lighting}`,
          sceneId: state.sceneId,
          characterId: state.characterId,
          status: "SUCCESS",
        },
      );

    case "SET_SCENE":
      return commit(
        state,
        {
          sceneId: command.sceneId,
        },
        {
          source: "DEBUG",
          type: "SCENE_CHANGE",
          label: "场景切换",
          detail: `场景 ${command.sceneId}`,
          previousScene: state.sceneId,
          nextScene: command.sceneId,
          sceneId: command.sceneId,
          characterId: state.characterId,
          status: "SUCCESS",
        },
      );

    case "SET_CHARACTER":
      return commit(
        state,
        {
          characterId: command.characterId,
          action: "IDLE",
          actionNonce: state.actionNonce + 1,
        },
        {
          source: "DEBUG",
          type: "CHARACTER_CHANGE",
          label: "角色切换",
          detail: `角色 ${command.characterId}`,
          previousCharacter: state.characterId,
          nextCharacter: command.characterId,
          previousAction: state.action,
          nextAction: "IDLE",
          sceneId: state.sceneId,
          characterId: command.characterId,
          status: "SUCCESS",
        },
      );

    case "SHOW_NOTICE":
      return commit(
        state,
        {
          systemNotice: command.message.trim(),
        },
        {
          source: "SYSTEM",
          type: "SYSTEM_NOTICE",
          label: "系统提示",
          detail: command.message.trim().slice(0, 120),
          sceneId: state.sceneId,
          characterId: state.characterId,
          status: "SUCCESS",
        },
      );

    case "CLEAR_NOTICE":
      return commit(
        state,
        {
          systemNotice: null,
        },
        null,
      );

    case "RESET": {
      const initial = createInitialCompanionState();
      return {
        state: {
          ...initial,
          revision: state.revision + 1,
          updatedAt: Date.now(),
        },
        event: {
          source: "SYSTEM",
          type: "INTERACTION",
          label: "重置",
          detail: "体验已重置",
          sceneId: initial.sceneId,
          characterId: initial.characterId,
          status: "SUCCESS",
        },
      };
    }
  }
}

