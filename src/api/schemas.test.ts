import { describe, expect, it } from "vitest";
import { aiAnalysisSchema } from "./schemas";

describe("AI response schema", () => {
  it("accepts a valid structured response", () => {
    expect(
      aiAnalysisSchema.parse({
        emotion: "HAPPY",
        action: "JUMP",
        reply: "听起来今天很顺利。",
        confidence: 0.91,
        provider: "gemini",
      }),
    ).toMatchObject({
      emotion: "HAPPY",
      action: "JUMP",
      provider: "gemini",
    });
  });

  it("rejects unknown actions and out-of-range confidence", () => {
    expect(() =>
      aiAnalysisSchema.parse({
        emotion: "HAPPY",
        action: "RUN_AWAY",
        reply: "test",
        confidence: 2,
      }),
    ).toThrow();
  });
});

