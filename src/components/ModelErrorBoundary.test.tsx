import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelErrorBoundary } from "./ModelErrorBoundary";

function BrokenModel(): never {
  throw new Error("model unavailable");
}

describe("ModelErrorBoundary", () => {
  it("renders its fallback and reports the model error", () => {
    const onError = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ModelErrorBoundary
        fallback={<p>轻量模式</p>}
        onError={onError}
      >
        <BrokenModel />
      </ModelErrorBoundary>,
    );

    expect(screen.getByText("轻量模式")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    consoleSpy.mockRestore();
  });
});

