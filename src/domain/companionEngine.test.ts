import { describe, expect, it } from "vitest";
import { analyzeText, quickActions } from "./companionEngine";

describe("local emotion rules", () => {
  it.each([
    ["晚安，早点睡", "SLEEPY"],
    ["你真的好棒", "HAPPY"],
    ["难过的时候陪陪我", "SAD"],
    ["我现在有点生气", "ANGRY"],
    ["今天天气不错", "IDLE"],
  ] as const)("maps %s to %s", (text, emotion) => {
    expect(analyzeText(text).emotion).toBe(emotion);
  });

  it.each([
    ["早上好", "HAPPY", "WAVE"],
    ["夸夸你，今天真的很棒", "HAPPY", "JUMP"],
    ["摸摸头，辛苦啦", "SHY", "WAVE"],
    ["晚安，我要睡了", "SLEEPY", "SIT"],
    ["最近真的很难过", "SAD", "IDLE"],
    ["这件事让我很生气", "ANGRY", "PUNCH"],
  ] as const)(
    "routes %s to a distinct %s / %s state",
    (text, emotion, action) => {
      const result = analyzeText(text);
      expect(result.emotion).toBe(emotion);
      expect(result.action).toBe(action);
      expect(result.reply).not.toBe(
        "我在听。今天想和我聊点什么？",
      );
    },
  );

  it("returns a specific reply for casual food and greeting input", () => {
    expect(analyzeText("早餐吃点什么好呢")).toMatchObject({
      emotion: "HAPPY",
      action: "WAVE",
    });
    expect(analyzeText("早上好").reply).toContain("早");
    expect(analyzeText("早餐吃点什么好呢").reply).not.toEqual(
      analyzeText("早上好").reply,
    );
  });

  it.each([
    ["我回来了", "HAPPY", "WAVE"],
    ["最近很焦虑", "SAD", "IDLE"],
    ["陪我看电影吧", "HAPPY", "WAVE"],
    ["有点无聊", "HAPPY", "WAVE"],
    ["对不起，刚才语气重了", "SHY", "WAVE"],
    ["你会做什么", "HAPPY", "WAVE"],
    ["bye", "SHY", "WAVE"],
  ] as const)(
    "covers broader conversational scene %s",
    (text, emotion, action) => {
      const result = analyzeText(text);
      expect(result.emotion).toBe(emotion);
      expect(result.action).toBe(action);
      expect(result.reply.length).toBeGreaterThan(4);
    },
  );

  it.each([
    ["下午好", "HAPPY", "WAVE"],
    ["好久不见", "HAPPY", "WAVE"],
    ["我想死你了", "SHY", "WAVE"],
    ["我最近开心不起来", "SAD", "IDLE"],
    ["头疼得厉害", "SAD", "IDLE"],
    ["我被裁员了", "SAD", "IDLE"],
    ["终于拿到 offer 了", "HAPPY", "JUMP"],
    ["陪我聊聊天吧", "SHY", "WAVE"],
    ["你吃饭了吗", "HAPPY", "WAVE"],
    ["今天降温了", "IDLE", "IDLE"],
    ["what can you do", "HAPPY", "WAVE"],
    ["I feel really lonely", "SAD", "IDLE"],
    ["好的", "IDLE", "IDLE"],
    ["哈哈哈哈哈", "HAPPY", "JUMP"],
    ["呜呜呜", "SAD", "IDLE"],
    ["see you", "SHY", "WAVE"],
    ["who are you", "HAPPY", "WAVE"],
    ["I passed the exam", "HAPPY", "JUMP"],
  ] as const)(
    "recognizes expanded natural expression %s",
    (text, emotion, action) => {
      const result = analyzeText(text);
      expect(result.emotion).toBe(emotion);
      expect(result.action).toBe(action);
      expect(result.reply.length).toBeGreaterThan(4);
    },
  );

  it("does not confuse an affectionate miss-you phrase with a crisis", () => {
    const affection = analyzeText("我想死你了");
    const crisis = analyzeText("我真的不想活了");

    expect(affection.emotion).toBe("SHY");
    expect(crisis.emotion).toBe("SAD");
    expect(crisis.reply).toContain("紧急援助");
  });

  it("gives generic questions a useful response instead of the idle fallback", () => {
    const result = analyzeText("冰箱里有什么");

    expect(result.emotion).toBe("IDLE");
    expect(result.reply).toContain("我听见你在问");
    expect(result.reply).not.toBe("我在听。今天想和我聊点什么？");
  });

  it("provides the three required quick actions", () => {
    expect(quickActions.map((action) => action.label)).toEqual([
      "摸摸头",
      "夸夸它",
      "哄它睡觉",
    ]);
  });
});

