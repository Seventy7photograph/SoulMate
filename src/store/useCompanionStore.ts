import { create } from "zustand";
import {
  analyzeMessage,
  persistEvent,
  toEmotionResult,
} from "../api/client";
import {
  analyzeText,
  getEmotionFallback,
  type ActionId,
  type Emotion,
  type EmotionResult,
} from "../domain/companionEngine";
import {
  createInitialCompanionState,
  reduceCompanionState,
  type ConversationMessage,
  type CharacterId,
  type CompanionEventDraft,
  type CompanionSnapshot,
  type CompanionTransition,
  type LightingPreset,
  type SceneId,
} from "../domain/companionState";
import { canCharacterUseAction } from "../domain/characterConfig";

export type {
  CharacterId,
  LightingPreset,
  SceneId,
} from "../domain/companionState";

export interface InteractionEvent extends CompanionEventDraft {
  id: string;
  timestamp: number;
}

export interface AppearanceSettings {
  displayName: string;
  accentColor: string;
  bio: string;
  customImageDataUrl: string | null;
  imageZoom: number;
}

interface CompanionStore extends CompanionSnapshot {
  events: InteractionEvent[];
  appearance: AppearanceSettings;
  aiStatus: "LOCAL" | "CONNECTING" | "AI" | "FALLBACK";
  aiEnabled: boolean;
  isThinking: boolean;
  voiceOutputEnabled: boolean;
  appendUserMessage: (text: string) => void;
  submitText: (text: string) => Promise<void>;
  runQuickAction: (result: EmotionResult, label: string) => void;
  forceEmotion: (emotion: Emotion) => void;
  forceAction: (action: ActionId) => void;
  setLighting: (lighting: LightingPreset) => void;
  setScene: (sceneId: SceneId) => void;
  setCharacter: (characterId: CharacterId) => void;
  showSystemNotice: (message: string) => void;
  setSystemInstruction: (instruction: string) => void;
  settleAction: (expectedActionNonce: number) => void;
  clearSystemNotice: () => void;
  clearEvents: () => void;
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
  setAiEnabled: (enabled: boolean) => void;
  setVoiceOutputEnabled: (enabled: boolean) => void;
  hydratePreferences: (payload: {
    displayName: string;
    accentColor: string;
    bio: string;
    sceneId: SceneId;
    characterId: CharacterId;
  }) => void;
}

const initialSnapshot = createInitialCompanionState();

const initialAppearance: AppearanceSettings = {
  displayName: "小雅",
  accentColor: "#ef8c24",
  bio: "住在午后温室里的数字生命。",
  customImageDataUrl: null,
  imageZoom: 1,
};

function eventId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function toInteractionEvent(
  draft: CompanionEventDraft | null,
): InteractionEvent | null {
  if (!draft) {
    return null;
  }

  return {
    ...draft,
    id: eventId(),
    timestamp: Date.now(),
  };
}

function applyTransition(
  state: CompanionStore,
  transition: CompanionTransition,
): Partial<CompanionStore> {
  const event = toInteractionEvent(transition.event);
  if (event && import.meta.env.MODE !== "test") {
    void persistEvent({
      source: event.source,
      type: event.type,
      label: event.label,
      detail: event.detail,
      emotion: transition.state.emotion,
      action: transition.state.action,
      sceneId: transition.state.sceneId,
      characterId: transition.state.characterId,
      status: event.status,
    }).catch(() => undefined);
  }
  return {
    ...transition.state,
    events: event
      ? [event, ...state.events].slice(0, 80)
      : state.events,
  };
}

export const useCompanionStore = create<CompanionStore>((set) => ({
  ...initialSnapshot,
  events: [],
  appearance: initialAppearance,
  aiStatus: "LOCAL",
  aiEnabled: true,
  isThinking: false,
  voiceOutputEnabled: false,

  appendUserMessage: (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const message: ConversationMessage = {
      id: eventId(),
      role: "USER",
      text: trimmed,
      timestamp: Date.now(),
    };
    set((state) =>
      applyTransition(
        state,
        reduceCompanionState(state, {
          type: "APPEND_MESSAGE",
          message,
        }),
      ),
    );
  },

  submitText: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    useCompanionStore.getState().appendUserMessage(trimmed);
    const startRevision = useCompanionStore.getState().revision;
    set({ isThinking: true, aiStatus: "CONNECTING" });

    let result = analyzeText(trimmed);
    let provider = "local";
    let status: "SUCCESS" | "FALLBACK" = "FALLBACK";
    let durationMs = 0;
    let source: "USER" | "AI" = "USER";

    const initialState = useCompanionStore.getState();
    if (
      initialState.aiEnabled &&
      initialState.characterId !== "CUSTOM_IMAGE"
    ) {
      try {
        const response = await analyzeMessage(trimmed, {
          systemInstruction: initialState.systemInstruction,
          displayName: initialState.appearance.displayName,
          bio: initialState.appearance.bio,
        });
        const latestState = useCompanionStore.getState();
        if (latestState.revision !== startRevision) {
          set({
            isThinking: false,
            aiStatus:
              latestState.aiStatus === "CONNECTING"
                ? "LOCAL"
                : latestState.aiStatus,
          });
          return;
        }
        if (
          !canCharacterUseAction(
            latestState.characterId,
            response.action,
          )
        ) {
          throw new Error("AI returned an unsupported action");
        }
        result = toEmotionResult(response);
        provider = response.provider;
        durationMs = response.durationMs;
        status = provider === "local" ? "FALLBACK" : "SUCCESS";
        source = provider === "local" ? "USER" : "AI";
      } catch {
        result = analyzeText(trimmed);
        provider = "local";
        status = "FALLBACK";
        source = "USER";
      }
    }

    if (result.confidence > 0) {
      set((state) =>
        applyTransition(
          state,
          reduceCompanionState(state, {
            type: "APPLY_RESULT",
            result,
            source,
            label: source === "AI" ? "AI 理解" : "文本互动",
            detail: trimmed.slice(0, 100),
            durationMs,
            provider,
            status,
          }),
        ),
      );
    }

    set({
      isThinking: false,
      aiStatus: provider === "local" ? "FALLBACK" : "AI",
    });
  },

  runQuickAction: (result, label) => {
    set((state) =>
      applyTransition(
        state,
        reduceCompanionState(state, {
          type: "APPLY_RESULT",
          result,
          source: "QUICK_ACTION",
          label: "快捷互动",
          detail: label,
          durationMs: 0,
          provider: "local",
        }),
      ),
    );
  },

  forceEmotion: (emotion) => {
    set((state) =>
      applyTransition(
        state,
        reduceCompanionState(state, {
          type: "APPLY_RESULT",
          result: getEmotionFallback(emotion),
          source: "DEBUG",
          label: "DEBUG",
          detail: `强制情绪 ${emotion}`,
          durationMs: 0,
        }),
      ),
    );
  },

  forceAction: (action) => {
    set((state) =>
      canCharacterUseAction(state.characterId, action)
        ? applyTransition(
            state,
            reduceCompanionState(state, {
              type: "DEBUG_SET_ACTION",
              action,
            }),
          )
        : {},
    );
  },

  setLighting: (lighting) => {
    set((state) =>
      applyTransition(
        state,
        reduceCompanionState(state, {
          type: "DEBUG_SET_LIGHTING",
          lighting,
        }),
      ),
    );
  },

  setScene: (sceneId) => {
    set((state) =>
      applyTransition(
        state,
        reduceCompanionState(state, {
          type: "SET_SCENE",
          sceneId,
        }),
      ),
    );
  },

  setCharacter: (characterId) => {
    set((state) =>
      applyTransition(
        state,
        reduceCompanionState(state, {
          type: "SET_CHARACTER",
          characterId,
        }),
      ),
    );
  },

  showSystemNotice: (message) => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    set((state) =>
      applyTransition(
        state,
        reduceCompanionState(state, {
          type: "SHOW_NOTICE",
          message: trimmed,
        }),
      ),
    );
  },

  setSystemInstruction: (instruction) => {
    set((state) =>
      applyTransition(
        state,
        reduceCompanionState(state, {
          type: "SET_SYSTEM_INSTRUCTION",
          instruction,
        }),
      ),
    );
  },

  settleAction: (expectedActionNonce) => {
    set((state) => {
      if (state.action === "IDLE") {
        return {};
      }
      return applyTransition(
        state,
        reduceCompanionState(state, {
          type: "SETTLE_ACTION",
          expectedActionNonce,
        }),
      );
    });
  },

  clearSystemNotice: () => {
    set((state) =>
      applyTransition(
        state,
        reduceCompanionState(state, { type: "CLEAR_NOTICE" }),
      ),
    );
  },

  clearEvents: () => {
    set({ events: [] });
  },

  updateAppearance: (patch) => {
    set((state) => ({
      appearance: {
        ...state.appearance,
        ...patch,
      },
    }));
  },

  setAiEnabled: (aiEnabled) => {
    set({ aiEnabled, aiStatus: "LOCAL" });
  },

  setVoiceOutputEnabled: (voiceOutputEnabled) => {
    set({ voiceOutputEnabled });
  },

  hydratePreferences: (payload) => {
    set((state) => ({
      sceneId: payload.sceneId,
      characterId: payload.characterId,
      appearance: {
        ...state.appearance,
        displayName:
          payload.displayName === "小宁"
            ? "小雅"
            : payload.displayName,
        accentColor: payload.accentColor,
        bio: payload.bio,
      },
    }));
  },
}));

