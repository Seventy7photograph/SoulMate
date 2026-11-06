import { expect, test, type Page } from "@playwright/test";

async function mockPersistence(page: Page): Promise<void> {
  await page.route("**/api/preferences", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "null",
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ saved: true }),
    });
  });
  await page.route("**/api/events", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ saved: true }),
    });
  });
}

async function openApp(page: Page): Promise<void> {
  await mockPersistence(page);
  await page.goto("/");
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-render-mode",
    "ready",
    { timeout: 20_000 },
  );
}

async function openDebug(page: Page): Promise<void> {
  await page.getByRole("button", { name: "打开调试面板" }).click();
  await expect(
    page.getByRole("complementary", { name: "开发者调试面板" }),
  ).toHaveClass(/is-open/);
}

test("text, quick actions, and drag rotation stay observable", async ({
  page,
}) => {
  await openApp(page);
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(
    page.locator('aside[aria-label="开发者调试面板"]'),
  ).toHaveJSProperty("inert", true);

  await page.getByRole("button", { name: "夸夸它" }).click();
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-emotion",
    "HAPPY",
  );
  await expect(
    page.getByRole("log", { name: "对话记录" }).getByText(
      "你这么说，我心里一下子亮起来了。",
    ),
  ).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.move(
      box.x + box.width * 0.94,
      box.y + box.height * 0.28,
    );
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-gaze-x")))
      .toBeGreaterThan(0.5);
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.28, box.y + box.height * 0.46, {
      steps: 12,
    });
    await page.mouse.up();
  }
  await expect(canvas).toHaveAttribute("data-view-interacted", "true");
});

test("all four humanoid forms use the verified rig and action mappings", async ({
  page,
}) => {
  await openApp(page);
  const host = page.locator(".companion-3d-host");

  await page.getByRole("button", { name: "摸摸头" }).click();
  await expect(host).toHaveAttribute("data-active-action", "WAVE");
  await expect(host).toHaveAttribute("data-active-clip", "Waving");

  await openDebug(page);
  await page.getByRole("button", { name: "强制动作 跳跃" }).click();
  await expect(host).toHaveAttribute(
    "data-active-clip",
    "Jump_Full_Short",
  );
  await page.getByRole("button", { name: "强制动作 欢呼" }).click();
  await expect(host).toHaveAttribute("data-active-clip", "Cheering");
  await page.getByRole("button", { name: "强制动作 挥拳" }).click();
  await expect(host).toHaveAttribute(
    "data-active-clip",
    "Melee_Unarmed_Attack_Punch_A",
  );
  await expect(host).toHaveAttribute("data-active-action", "IDLE", {
    timeout: 4_000,
  });
  await expect(host).toHaveAttribute("data-idle-transition", "resume");
  await page.getByRole("button", { name: "强制动作 坐下" }).click();
  await expect(host).toHaveAttribute(
    "data-active-clip",
    "Sit_Floor_Idle",
  );

  const forms = [
    ["SUNNY_HUMAN", "小雅 · 森语"],
    ["KAYKIT_ROGUE_HOODED", "小雅 · 暮行"],
    ["KAYKIT_MAGE", "小雅 · 星辉"],
    ["KAYKIT_RANGER", "小雅 · 风行"],
  ] as const;
  for (const [id, label] of forms) {
    await page
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(page.getByTestId("companion-stage")).toHaveAttribute(
      "data-character",
      id,
    );
    await expect(page.getByTestId("companion-stage")).toHaveAttribute(
      "data-render-mode",
      "ready",
      { timeout: 20_000 },
    );
    await expect(host).toHaveAttribute("data-active-clip", "Idle_A");
  }
});

test("head bubble clears the folded history and dismisses by itself", async ({
  page,
}) => {
  await openApp(page);
  const input = page.getByPlaceholder("和小雅说点什么");
  const bubble = page.getByTestId("speech-bubble");
  const history = page.getByRole("log", { name: "对话记录" });

  await input.click();
  await expect(bubble).toHaveText("我在听，你慢慢说。");
  await expect(history).toBeVisible();

  const bubbleBox = await bubble.boundingBox();
  const historyBox = await history.boundingBox();
  expect(bubbleBox).not.toBeNull();
  expect(historyBox).not.toBeNull();
  if (bubbleBox && historyBox) {
    expect(bubbleBox.x).toBeGreaterThan(
      historyBox.x + historyBox.width,
    );
  }

  await page.waitForTimeout(5_300);
  await expect(bubble).toHaveCount(0);
});

test("the humanoid sleepy sit uses the full rig and remains seated", async ({
  page,
}) => {
  await openApp(page);
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-character",
    "SUNNY_HUMAN",
  );
  await page.getByRole("button", { name: "哄它睡觉" }).click();
  await expect(page.getByLabel("当前情绪状态码")).toHaveText("SLEEPY");
  await expect(page.getByTestId("current-action")).toHaveText("SIT");
  await page.waitForTimeout(6_000);
  await expect(page.getByTestId("current-action")).toHaveText("SIT");
});

test("developer drawer status, history, and instruction paths are real", async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole("button", { name: "夸夸它" }).click();
  await openDebug(page);

  await page.getByRole("button", { name: "强制动作 挥拳" }).click();
  await expect(page.getByTestId("current-action")).toHaveText("PUNCH");
  await expect(page.getByLabel("当前情绪状态码")).toHaveText("HAPPY");
  await expect(page.getByTestId("current-action")).toHaveText("IDLE", {
    timeout: 3_000,
  });
  await page.getByRole("button", { name: "暖橙" }).click();
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-lighting",
    "WARM",
  );

  await page.getByRole("tab", { name: "集成" }).click();
  await page
    .getByRole("textbox", { name: "角色行为指令" })
    .fill("回答简短，像在夜晚轻声说话。");
  await page.getByRole("button", { name: "应用角色指令" }).click();
  await page.getByPlaceholder("输入临时预览文字").fill("系统校准完成");
  await page.getByRole("button", { name: "发送系统提示" }).click();
  await expect(
    page.getByTestId("companion-stage").getByText("系统校准完成"),
  ).toBeVisible();

  await page.getByRole("tab", { name: "历史" }).click();
  await expect(
    page.getByRole("log", { name: "互动历史日志" }),
  ).toBeVisible();
  await expect(page.getByText("开发者指令")).toBeVisible();
  await page.getByRole("button", { name: "清空互动历史" }).click();
  await page.getByRole("button", { name: "确认" }).click();
  await expect(page.getByText("等待第一次互动")).toBeVisible();
});

test("scene and character switching preserve independent state", async ({
  page,
}) => {
  await openApp(page);
  await page
    .getByRole("navigation", { name: "场景选择" })
    .getByRole("button", { name: "太空" })
    .click();
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-scene",
    "SPACE",
  );

  await openDebug(page);
  await page
    .getByRole("button", { name: "小雅 · 机械体", exact: true })
    .click();
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-character",
    "ROBOT_EXPRESSIVE",
  );
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-render-mode",
    "ready",
    { timeout: 20_000 },
  );
  await expect(page.getByTestId("current-scene")).toHaveText("SPACE");

  await page.getByRole("button", { name: "关闭调试面板", exact: true }).click();
  await page.getByRole("button", { name: "哄它睡觉" }).click();
  await expect(page.getByLabel("当前情绪状态码")).toHaveText("SLEEPY");
  await expect(page.getByTestId("current-action")).toHaveText("SIT");
  await page.waitForTimeout(6_000);
  await expect(page.getByTestId("current-action")).toHaveText("SIT");
});

test("system time and live weather are opt-in environment modes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(
          success: (position: unknown) => void,
        ) {
          success({
            coords: {
              latitude: 23.1291,
              longitude: 113.2644,
            },
          });
        },
      },
    });
  });
  await page.route("https://api.open-meteo.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        current: {
          temperature_2m: 24.2,
          weather_code: 61,
          is_day: 1,
        },
      }),
    });
  });
  await openApp(page);
  await openDebug(page);
  await page.getByRole("tab", { name: "集成" }).click();
  await page.getByRole("button", { name: "实时天气" }).click();
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-weather",
    "RAIN",
  );
  await expect(page.getByText("24°C", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "实时天气" }).click();
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-weather",
    "CLEAR",
  );

  await page.getByRole("button", { name: "跟随时间" }).click();
  await expect(page.getByRole("button", { name: "跟随时间" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("scene-habitat")).toHaveAttribute(
    "data-day-phase",
    /DAWN|DAY|DUSK|NIGHT/,
  );
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-weather",
    "CLEAR",
  );
});

test("AI success and local fallback preserve visible conversation", async ({
  page,
}) => {
  await mockPersistence(page);
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        emotion: "HAPPY",
        action: "JUMP",
        reply: "今天的光也站在你这边。",
        confidence: 0.92,
        provider: "gemini",
      }),
    });
  });
  await page.goto("/");
  const input = page.getByPlaceholder("和小雅说点什么");
  await input.fill("今天特别顺利");
  await page.getByRole("button", { name: "发送文字" }).click();
  await expect(
    page.getByRole("log", { name: "对话记录" }).getByText("今天特别顺利"),
  ).toBeVisible();
  await expect(
    page.getByRole("log", { name: "对话记录" }).getByText(
      "今天的光也站在你这边。",
    ),
  ).toBeVisible();

  await page.unroute("**/api/analyze");
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({ status: 503, body: "unavailable" });
  });
  await input.fill("晚安，早点睡");
  await page.getByRole("button", { name: "发送文字" }).click();
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-emotion",
    "SLEEPY",
  );
  await openDebug(page);
  await expect(page.getByTestId("ai-status")).toHaveText("FALLBACK");
});

test("local semantic routing produces distinct replies, emotions, and scene moods", async ({
  page,
}) => {
  await openApp(page);
  const input = page.getByPlaceholder("和小雅说点什么");
  const send = page.getByRole("button", { name: "发送文字" });
  const stage = page.getByTestId("companion-stage");
  const scene = page.getByTestId("scene-habitat");
  const replies: string[] = [];

  const messages = [
    ["早上好", "HAPPY"],
    ["早餐吃点什么好呢", "HAPPY"],
    ["我现在有点生气", "ANGRY"],
    ["晚安，我要睡了", "SLEEPY"],
  ] as const;

  for (const [text, emotion] of messages) {
    await input.fill(text);
    await send.click();
    await expect(stage).toHaveAttribute("data-emotion", emotion);
    await expect(scene).toHaveAttribute("data-emotion", emotion);
    const latestReply = page
      .getByRole("log", { name: "对话记录" })
      .locator("article")
      .last();
    await expect(latestReply).not.toContainText(
      "我在听。今天想和我聊点什么？",
    );
    replies.push((await latestReply.textContent()) ?? "");
  }

  expect(new Set(replies).size).toBe(4);
  expect(replies.every((reply) => !reply.includes("我在听。今天想和我聊点什么？")))
    .toBe(true);
});

test("custom image upload appears in the appearance tab", async ({ page }) => {
  await openApp(page);
  await openDebug(page);
  await page.getByRole("tab", { name: "外观" }).click();
  await page.locator('input[type="file"]').setInputFiles("public/favicon.svg");
  await expect(page.getByAltText("自定义角色预览")).toBeVisible();
  await page.getByLabel("名称").fill("阿宁");
  await page.getByRole("tab", { name: "状态" }).click();
  await page.getByRole("button", { name: "自定义形象" }).click();
  await page.getByRole("button", { name: "关闭调试面板", exact: true }).click();

  await expect(page.getByTestId("custom-companion")).toBeVisible();
  await expect(page.getByPlaceholder("和阿宁说点什么")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("aolinu-custom-image")),
    )
    .toContain("data:image/svg+xml");
});

test("voice recognition fills the text field and wake word starts a turn", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;

      start() {
        const transcript = this.continuous ? "你好小雅" : "今天真的好开心";
        this.onresult?.({
          results: [[{ transcript }]],
        });
        this.onend?.();
      }

      stop() {
        this.onend?.();
      }

      abort() {
        this.onend?.();
      }
    }

    Object.assign(window, {
      SpeechRecognition: MockSpeechRecognition,
      webkitSpeechRecognition: MockSpeechRecognition,
    });
  });

  await openApp(page);
  await page.getByRole("button", { name: "开启语音唤醒" }).click();
  await expect(page.getByPlaceholder("和小雅说点什么")).toHaveValue(
    "今天真的好开心",
  );
  await page.getByRole("button", { name: "发送文字" }).click();
  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-emotion",
    "HAPPY",
  );
});

test("microphone denial and unsupported recognition preserve fallback paths", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class DeniedSpeechRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;

      start() {
        this.onerror?.({ error: "not-allowed" });
        this.onend?.();
      }

      stop() {}
      abort() {}
    }

    Object.assign(window, {
      SpeechRecognition: DeniedSpeechRecognition,
      webkitSpeechRecognition: DeniedSpeechRecognition,
    });
  });
  await openApp(page);
  await page.getByRole("button", { name: "开始语音输入" }).click();
  await expect(page.getByText("麦克风权限被拒绝")).toBeVisible();
  await expect(page.getByPlaceholder("和小雅说点什么")).toBeEditable();
});

test("unsupported speech recognition disables voice and wake controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await openApp(page);
  await expect(
    page.getByRole("button", { name: "语音输入不可用" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "开启语音唤醒" }),
  ).toBeDisabled();
});

test("model failure falls back and the mobile drawer closes with Escape", async ({
  page,
}) => {
  await page.route("**/models/companion/Xiaoning.glb", async (route) => {
    await route.fulfill({ status: 404, body: "missing" });
  });
  await mockPersistence(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByTestId("companion-stage")).toHaveAttribute(
    "data-render-mode",
    "fallback",
    { timeout: 20_000 },
  );
  await expect(
    page.getByRole("img", { name: /轻量模式小雅/ }),
  ).toBeVisible();
  await openDebug(page);
  await expect(page.getByRole("tab", { name: "历史" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.locator('aside[aria-label="开发者调试面板"]'),
  ).toHaveAttribute("aria-hidden", "true");

  await openDebug(page);
  const panel = page.locator('aside[aria-label="开发者调试面板"]');
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  if (panelBox) {
    expect(panelBox.x).toBeGreaterThanOrEqual(0);
    expect(panelBox.width).toBeLessThanOrEqual(390);
    expect(panelBox.height).toBeLessThanOrEqual(844);
  }
  await expect
    .poll(() =>
      panel.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    )
    .toBe(true);
});
