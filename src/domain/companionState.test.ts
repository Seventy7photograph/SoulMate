import { describe, expect, it } from "vitest";
import { getEmotionFallback } from "./companionEngine";
import {
  ACTION_DURATION_MS,
  createInitialCompanionState,
  reduceCompanionState,
} from "./companionState";

describe("companion state reducer", () => {
  it("force-changes action without changing emotion", () => {
    const initial = createInitialCompanionState();
    const transition = reduceCompanionState(initial, {
      type: "DEBUG_SET_ACTION",
      action: "PUNCH",
    });

    expect(transition.state.action).toBe("PUNCH");
    expect(transition.state.emotion).toBe("IDLE");
    expect(transition.state.revision).toBe(1);
    expect(transition.event).toMatchObject({
      type: "ACTION_CHANGE",
      source: "DEBUG",
      previousAction: "IDLE",
      nextAction: "PUNCH",
    });
  });

  it("changes scene without changing emotion", () => {
    const initial = createInitialCompanionState();
    const transition = reduceCompanionState(initial, {
      type: "SET_SCENE",
      sceneId: "SPACE",
    });

    expect(transition.state.sceneId).toBe("SPACE");
    expect(transition.state.emotion).toBe("IDLE");
    expect(transition.event?.type).toBe("SCENE_CHANGE");
  });

  it("changes character while preserving scene", () => {
    const initial = {
      ...createInitialCompanionState(),
      sceneId: "FOREST" as const,
    };
    const transition = reduceCompanionState(initial, {
      type: "SET_CHARACTER",
      characterId: "ROBOT_EXPRESSIVE",
    });

    expect(transition.state.characterId).toBe("ROBOT_EXPRESSIVE");
    expect(transition.state.sceneId).toBe("FOREST");
    expect(transition.state.action).toBe("IDLE");
  });

  it("applies an emotion result and records the full transition", () => {
    const initial = createInitialCompanionState();
    const transition = reduceCompanionState(initial, {
      type: "APPLY_RESULT",
      result: getEmotionFallback("HAPPY"),
      source: "QUICK_ACTION",
      label: "夸夸它",
      detail: "快捷互动",
      durationMs: 12,
    });

    expect(transition.state.emotion).toBe("HAPPY");
    expect(transition.state.action).toBe("JUMP");
    expect(transition.state.actionNonce).toBe(1);
    expect(transition.state.messages.at(-1)).toMatchObject({
      role: "COMPANION",
      text: getEmotionFallback("HAPPY").reply,
    });
    expect(transition.event).toMatchObject({
      type: "EMOTION_CHANGE",
      source: "QUICK_ACTION",
      previousEmotion: "IDLE",
      nextEmotion: "HAPPY",
      status: "SUCCESS",
      durationMs: 12,
    });
  });

  it("keeps system notices separate from the companion reply", () => {
    const initial = createInitialCompanionState();
    const transition = reduceCompanionState(initial, {
      type: "SHOW_NOTICE",
      message: "系统校准完成",
    });

    expect(transition.state.systemNotice).toBe("系统校准完成");
    expect(transition.state.reply).toBe(initial.reply);
    expect(transition.event?.type).toBe("SYSTEM_NOTICE");
  });

  it("appends a user message without changing the companion reply", () => {
    const initial = createInitialCompanionState();
    const transition = reduceCompanionState(initial, {
      type: "APPEND_MESSAGE",
      message: {
        id: "user-1",
        role: "USER",
        text: "今天有点累",
        timestamp: 100,
      },
    });

    expect(transition.state.reply).toBe(initial.reply);
    expect(transition.state.messages.at(-1)).toMatchObject({
      id: "user-1",
      role: "USER",
      text: "今天有点累",
    });
    expect(transition.event).toBeNull();
  });

  it("stores a real system instruction separately from a notice", () => {
    const initial = createInitialCompanionState();
    const transition = reduceCompanionState(initial, {
      type: "SET_SYSTEM_INSTRUCTION",
      instruction: "回答简短，像在夜晚轻声说话。",
    });

    expect(transition.state.systemInstruction).toBe(
      "回答简短，像在夜晚轻声说话。",
    );
    expect(transition.state.systemNotice).toBeNull();
    expect(transition.event?.type).toBe("SYSTEM_NOTICE");
  });

  it("settles a one-shot action only for the matching action run", () => {
    const initial = {
      ...createInitialCompanionState(),
      action: "SIT" as const,
      actionNonce: 4,
    };
    const stale = reduceCompanionState(initial, {
      type: "SETTLE_ACTION",
      expectedActionNonce: 3,
    });
    const settled = reduceCompanionState(initial, {
      type: "SETTLE_ACTION",
      expectedActionNonce: 4,
    });

    expect(stale.state).toBe(initial);
    expect(stale.state.revision).toBe(initial.revision);
    expect(settled.state.action).toBe("IDLE");
    expect(settled.state.emotion).toBe("IDLE");
    expect(settled.state.revision).toBe(initial.revision);
    expect(settled.event).toBeNull();
  });

  it("declares finite durations for every one-shot action", () => {
    expect(ACTION_DURATION_MS.IDLE).toBe(0);
    expect(ACTION_DURATION_MS.SIT).toBe(0);
    expect(ACTION_DURATION_MS.JUMP).toBeGreaterThan(0);
  });
});

