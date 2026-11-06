import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ConversationMessage } from "../domain/companionState";
import { ConversationStream } from "./ConversationStream";

const messages: ConversationMessage[] = [
  {
    id: "one",
    role: "COMPANION",
    text: "我在听。",
    timestamp: 1,
  },
  {
    id: "two",
    role: "USER",
    text: "今天有点累。",
    timestamp: 2,
  },
];

describe("ConversationStream", () => {
  it("keeps the user's submitted text visible", () => {
    render(
      <ConversationStream
        messages={messages}
        isThinking={false}
        companionName="小雅"
      />,
    );

    expect(screen.getByText("今天有点累。")).toBeVisible();
    expect(screen.getByText("我在听。")).toBeVisible();
  });

  it("announces a thinking response without removing history", () => {
    render(
      <ConversationStream
        messages={messages}
        isThinking
        companionName="小雅"
      />,
    );

    expect(screen.getByText("小雅正在回应")).toBeVisible();
    expect(screen.getByText("今天有点累。")).toBeVisible();
  });

  it("folds older history and can expand it again", async () => {
    const user = userEvent.setup();
    render(
      <ConversationStream
        messages={[
          ...messages,
          {
            id: "three",
            role: "COMPANION",
            text: "第三条",
            timestamp: 3,
          },
          {
            id: "four",
            role: "USER",
            text: "第四条",
            timestamp: 4,
          },
        ]}
        isThinking={false}
        companionName="小雅"
      />,
    );

    expect(screen.queryByText("我在听。")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "展开对话记录，还有1条",
      }),
    );
    expect(screen.getByText("我在听。")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "收起对话记录" }),
    ).toBeVisible();
  });
});
