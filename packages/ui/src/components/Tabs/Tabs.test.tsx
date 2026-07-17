import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Tabs } from "./Tabs";

const items = [
  { id: "overview", label: "Overview" },
  { id: "notes", label: "Notes" },
  { id: "history", label: "History" },
];

describe("Tabs", () => {
  it("renders all tab labels", () => {
    render(
      <Tabs items={items} activeId="overview" onChange={vi.fn()}>
        Overview content
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "History" })).toBeInTheDocument();
  });

  it("renders the tablist and panel roles", () => {
    render(
      <Tabs items={items} activeId="overview" onChange={vi.fn()}>
        <p>Overview content</p>
      </Tabs>,
    );

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Overview content");
  });

  it("calls onChange with the clicked tab's id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs items={items} activeId="overview" onChange={onChange}>
        Overview content
      </Tabs>,
    );

    await user.click(screen.getByRole("tab", { name: "Notes" }));

    expect(onChange).toHaveBeenCalledWith("notes");
  });

  it("reflects the active tab via aria-selected", () => {
    render(
      <Tabs items={items} activeId="notes" onChange={vi.fn()}>
        Notes content
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("moves selection to the next tab on ArrowRight", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs items={items} activeId="overview" onChange={onChange}>
        Overview content
      </Tabs>,
    );

    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("notes");
  });

  it("wraps to the first tab on ArrowRight from the last tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs items={items} activeId="history" onChange={onChange}>
        History content
      </Tabs>,
    );

    screen.getByRole("tab", { name: "History" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("overview");
  });

  it("moves selection to the previous tab on ArrowLeft", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs items={items} activeId="notes" onChange={onChange}>
        Notes content
      </Tabs>,
    );

    screen.getByRole("tab", { name: "Notes" }).focus();
    await user.keyboard("{ArrowLeft}");

    expect(onChange).toHaveBeenCalledWith("overview");
  });

  it("wraps to the last tab on ArrowLeft from the first tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs items={items} activeId="overview" onChange={onChange}>
        Overview content
      </Tabs>,
    );

    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("{ArrowLeft}");

    expect(onChange).toHaveBeenCalledWith("history");
  });

  it("jumps to the first tab on Home", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs items={items} activeId="history" onChange={onChange}>
        History content
      </Tabs>,
    );

    screen.getByRole("tab", { name: "History" }).focus();
    await user.keyboard("{Home}");

    expect(onChange).toHaveBeenCalledWith("overview");
  });

  it("jumps to the last tab on End", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs items={items} activeId="overview" onChange={onChange}>
        Overview content
      </Tabs>,
    );

    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("{End}");

    expect(onChange).toHaveBeenCalledWith("history");
  });

  it("moves focus to the newly selected tab on keyboard navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs items={items} activeId="overview" onChange={onChange}>
        Overview content
      </Tabs>,
    );

    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Notes" })).toHaveFocus();
  });
});
