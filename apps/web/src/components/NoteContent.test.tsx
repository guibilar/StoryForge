import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NoteContent } from "./NoteContent";

const TARGETS = {
  entities: [{ id: "e-1", name: "Carlos Mendoza" }],
  notes: [{ id: "n-1", title: "Session 1 recap" }],
};

function renderContent(content: string) {
  const onOpenEntity = vi.fn();
  const onOpenNote = vi.fn();
  render(
    <NoteContent
      content={content}
      targets={TARGETS}
      onOpenEntity={onOpenEntity}
      onOpenNote={onOpenNote}
    />,
  );
  return { onOpenEntity, onOpenNote };
}

describe("NoteContent", () => {
  it("renders the note's markdown", () => {
    renderContent("# Heading\n\nSome **bold** prose.");

    expect(
      screen.getByRole("heading", { name: "Heading" }),
    ).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
  });

  it("opens the entity window when an entity wiki link is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenEntity, onOpenNote } = renderContent(
      "Met [[Carlos Mendoza]].",
    );

    await user.click(screen.getByRole("link", { name: "Carlos Mendoza" }));

    expect(onOpenEntity).toHaveBeenCalledWith("e-1");
    expect(onOpenNote).not.toHaveBeenCalled();
  });

  it("opens the note window when a note wiki link is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenEntity, onOpenNote } = renderContent(
      "See [[Session 1 recap]]",
    );

    await user.click(screen.getByRole("link", { name: "Session 1 recap" }));

    expect(onOpenNote).toHaveBeenCalledWith("n-1");
    expect(onOpenEntity).not.toHaveBeenCalled();
  });

  it("renders an unresolvable reference without navigating anywhere", async () => {
    const user = userEvent.setup();
    const { onOpenEntity, onOpenNote } = renderContent("[[Nobody]] was there.");

    const link = screen.getByRole("link", { name: "Nobody" });
    expect(link).toHaveAttribute("href", "#sf-link:unresolved");

    await user.click(link);

    expect(onOpenEntity).not.toHaveBeenCalled();
    expect(onOpenNote).not.toHaveBeenCalled();
  });

  it("leaves ordinary links to the browser", async () => {
    const user = userEvent.setup();
    const { onOpenEntity, onOpenNote } = renderContent(
      "[docs](https://example.com)",
    );

    await user.click(screen.getByRole("link", { name: "docs" }));

    expect(onOpenEntity).not.toHaveBeenCalled();
    expect(onOpenNote).not.toHaveBeenCalled();
  });
});
