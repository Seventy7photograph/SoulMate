import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DebugConsole } from "./DebugConsole";

function renderConsole(overrides: Partial<Parameters<typeof DebugConsole>[0]> = {}) {
  const props: Parameters<typeof DebugConsole>[0] = {
    emotion: "IDLE",
    action: "IDLE",
    lighting: "AUTO",
    sceneId: "MEADOW",
    characterId: "ROBOT_EXPRESSIVE",
    revision: 2,
    events: [
      {
        id: "event-1",
        timestamp: 100,
        source: "USER",
        type: "EMOTION_CHANGE",
        label: "文本互动",
        detail: "今天有点累",
        sceneId: "MEADOW",
        characterId: "ROBOT_EXPRESSIVE",
        status: "SUCCESS",
      },
    ],
    appearance: {
      displayName: "小雅",
      accentColor: "#ef8c24",
      bio: "夜航温室里的数字生命。",
      customImageDataUrl: null,
      imageZoom: 1,
    },
    aiStatus: "LOCAL",
    aiEnabled: true,
    voiceOutputEnabled: false,
    voiceOutputSupported: true,
    isOpen: true,
    systemInstruction: "",
    environmentMode: "MANUAL",
    environmentStatus: "",
    environmentLoading: false,
    onClose: vi.fn(),
    onForceEmotion: vi.fn(),
    onForceAction: vi.fn(),
    onSetLighting: vi.fn(),
    onSetScene: vi.fn(),
    onSetCharacter: vi.fn(),
    onShowNotice: vi.fn(),
    onSetSystemInstruction: vi.fn(),
    onToggleTimeEnvironment: vi.fn(),
    onToggleWeatherEnvironment: vi.fn(),
    onClearEvents: vi.fn(),
    onUpdateAppearance: vi.fn(),
    onSetAiEnabled: vi.fn(),
    onSetVoiceOutput: vi.fn(),
  };
  render(<DebugConsole {...props} {...overrides} />);
}

describe("DebugConsole drawer", () => {
  it("removes closed drawer controls from keyboard navigation", () => {
    renderConsole({ isOpen: false });

    const drawer = document.querySelector('aside[aria-label="开发者调试面板"]');
    expect(drawer).toHaveAttribute("inert");
    expect(drawer).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps full event history available in its own tab", async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.click(screen.getByRole("tab", { name: "历史" }));

    expect(screen.getByRole("log", { name: "互动历史日志" })).toBeVisible();
    expect(screen.getByText("今天有点累")).toBeVisible();
  });

  it("applies a developer instruction separately from a notice preview", async () => {
    const user = userEvent.setup();
    const onSetSystemInstruction = vi.fn();
    renderConsole({ onSetSystemInstruction });

    await user.click(screen.getByRole("tab", { name: "集成" }));
    await user.type(
      screen.getByRole("textbox", { name: "角色行为指令" }),
      "回答简短",
    );
    await user.click(screen.getByRole("button", { name: "应用角色指令" }));

    expect(onSetSystemInstruction).toHaveBeenCalledWith("回答简短");
  });
});
