import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  matchesWakePhrase,
  useSpeechRecognition,
} from "./useSpeechRecognition";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("wake word recognition", () => {
  it("normalizes spacing and punctuation around the wake phrase", () => {
    expect(matchesWakePhrase("你好，小雅！", "小雅")).toBe(true);
    expect(matchesWakePhrase("今天天气不错", "小雅")).toBe(false);
  });

  it("detects the wake phrase from continuous recognition", () => {
    const onWake = vi.fn();
    const onResult = vi.fn();

    class MockRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;

      start() {
        this.onresult?.({
          results: [[{ transcript: "你好小雅" }]],
        });
      }

      stop() {}
      abort() {}
    }

    vi.stubGlobal("SpeechRecognition", MockRecognition);
    vi.stubGlobal("webkitSpeechRecognition", MockRecognition);

    const { result } = renderHook(() =>
      useSpeechRecognition({
        onResult,
        onWake,
        companionName: "小雅",
      }),
    );

    act(() => {
      result.current.startWakeListening();
    });

    expect(onWake).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
  });
});
