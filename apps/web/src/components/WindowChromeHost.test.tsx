import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WindowChromeHost } from "./WindowChromeHost";
import { useWindowChromeSync } from "../lib/WindowChromeContext";

function Content({
  isLoading,
  onRefresh,
}: {
  isLoading: boolean;
  onRefresh?: () => void;
}) {
  useWindowChromeSync(isLoading, onRefresh);
  return <p>Body content</p>;
}

describe("WindowChromeHost", () => {
  it("has no refresh button or loading overlay when content reports neither", () => {
    render(
      <WindowChromeHost title="NPCs" onClose={vi.fn()}>
        <Content isLoading={false} />
      </WindowChromeHost>,
    );

    expect(
      screen.queryByRole("button", { name: "Refresh NPCs" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a loading overlay when content reports isLoading", () => {
    render(
      <WindowChromeHost title="NPCs" onClose={vi.fn()}>
        <Content isLoading />
      </WindowChromeHost>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading NPCs");
  });

  it("shows a refresh button that calls the content's refresh callback", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(
      <WindowChromeHost title="NPCs" onClose={vi.fn()}>
        <Content isLoading={false} onRefresh={onRefresh} />
      </WindowChromeHost>,
    );

    await user.click(screen.getByRole("button", { name: "Refresh NPCs" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
