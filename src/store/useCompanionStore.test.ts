import { beforeEach, describe, expect, it } from "vitest";
import { createInitialCompanionState } from "../domain/companionState";
import { useCompanionStore } from "./useCompanionStore";

describe("companion store", () => {
  beforeEach(() => {
    useCompanionStore.setState({
      ...createInitialCompanionState(),
      events: [],
      aiEnabled: false,
      aiStatus: "LOCAL",
    });
  });

  it("ignores blank text without changing revision or history", async () => {
    const before = useCompanionStore.getState();
    await useCompanionStore.getState().submitText("   ");
    const after = useCompanionStore.getState();

    expect(after.revision).toBe(before.revision);
    expect(after.events).toHaveLength(0);
    expect(after.messages).toHaveLength(before.messages.length);
  });

  it("shows a submitted user message and the local companion response", async () => {
    await useCompanionStore.getState().submitText("晚安，早点睡");
    const state = useCompanionStore.getState();

    expect(state.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "USER", text: "晚安，早点睡" }),
        expect.objectContaining({
          role: "COMPANION",
          emotion: "SLEEPY",
        }),
      ]),
    );
    expect(
      state.messages
        .filter((message) => message.role === "COMPANION")
        .at(-1)
        ?.text,
    ).not.toBe("我在听。今天想和我聊点什么？");
    expect(state.action).toBe("SIT");
    expect(state.actionNonce).toBe(1);
  });

  it("keeps a developer instruction in shared state", () => {
    useCompanionStore
      .getState()
      .setSystemInstruction("不要连续使用感叹号。");

    expect(useCompanionStore.getState().systemInstruction).toBe(
      "不要连续使用感叹号。",
    );
  });

  it("migrates the legacy companion name to 小雅", () => {
    useCompanionStore.getState().hydratePreferences({
      displayName: "小宁",
      accentColor: "#ef8c24",
      bio: "住在午后温室里的数字生命。",
      sceneId: "MEADOW",
      characterId: "SUNNY_HUMAN",
    });

    expect(useCompanionStore.getState().appearance.displayName).toBe(
      "小雅",
    );
  });

  it("settles an action when the action run still matches", () => {
    useCompanionStore.getState().forceAction("WAVE");
    const run = useCompanionStore.getState().actionNonce;

    useCompanionStore.getState().settleAction(run);

    expect(useCompanionStore.getState().action).toBe("IDLE");
  });

  it("rejects an action unsupported by the active character", () => {
    useCompanionStore.getState().setCharacter("CUSTOM_IMAGE");
    const before = useCompanionStore.getState().revision;

    useCompanionStore.getState().forceAction("PUNCH");

    expect(useCompanionStore.getState().action).toBe("IDLE");
    expect(useCompanionStore.getState().revision).toBe(before);
  });
});

