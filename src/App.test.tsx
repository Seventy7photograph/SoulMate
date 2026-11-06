import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("AOLINU SoulMate shell", () => {
  it("renders the companion workspace and required controls", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText("AOLINU")).toBeInTheDocument();
    expect(screen.getByText(/SoulMate/)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("和小雅说点什么"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "摸摸头" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "夸夸它" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "哄它睡觉" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("当前情绪状态码")).toHaveTextContent(
      "IDLE",
    );
    await user.click(screen.getByRole("button", { name: "打开调试面板" }));
    expect(
      screen.getByRole("heading", { name: "状态监控与远程调试" }),
    ).toBeInTheDocument();
  });

  it("updates emotion and interaction history from a quick action", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "夸夸它" }));

    expect(screen.getByLabelText("当前情绪状态码")).toHaveTextContent(
      "HAPPY",
    );
    expect(
      screen.getAllByText("你这么说，我心里一下子亮起来了。").length,
    ).toBeGreaterThan(0);
  });

  it("lets the developer console force an emotion", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "打开调试面板" }));
    await user.click(screen.getByRole("button", { name: "强制 SAD" }));

    expect(screen.getByLabelText("当前情绪状态码")).toHaveTextContent(
      "SAD",
    );
    await user.click(screen.getByRole("tab", { name: "历史" }));
    expect(screen.getByText("DEBUG")).toBeInTheDocument();
  });
});

