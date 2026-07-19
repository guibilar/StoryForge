import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "urql";

import { EntitySidebar } from "./EntitySidebar";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import type { OpenWindowRequest } from "../lib/DesktopWindowsContext";
import { EntitiesDocument } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useQuery: vi.fn() };
});

vi.mock("../lib/DesktopWindowsContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/DesktopWindowsContext")>();
  return { ...actual, useDesktopWindows: vi.fn() };
});

const ENTITIES = [
  {
    id: "e-1",
    name: "Carlos Mendoza",
    type: "Character",
    description: "A Tremere regent",
    visibility: "PUBLIC",
  },
  {
    id: "e-2",
    name: "Beatriz Moreau",
    type: "Character",
    description: null,
    visibility: "PUBLIC",
  },
  {
    id: "e-3",
    name: "Downtown",
    type: "Location",
    description: null,
    visibility: "PUBLIC",
  },
];

function setupQueries({ entities = ENTITIES, reexecute = vi.fn() } = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === EntitiesDocument) {
      return [{ data: { entities }, fetching: false, stale: false }, reexecute];
    }
    throw new Error("Unexpected query in test");
  }) as never);

  return { reexecute };
}

function setupDesktopWindows({ notesHidden = true } = {}) {
  const toggle = vi.fn();
  const openWindow = vi.fn();
  const hiddenLayout = Object.fromEntries(
    ["timeline", "sessions", "notes", "members", "relationships"].map((id) => [
      id,
      {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        hidden: id === "notes" ? notesHidden : true,
        z: 0,
      },
    ]),
  );
  vi.mocked(useDesktopWindows).mockReturnValue({
    layout: hiddenLayout,
    bringToFront: vi.fn(),
    toggle,
    startDrag: vi.fn(),
    startResize: vi.fn(),
    reset: vi.fn(),
    dynamicWindows: {},
    openWindow,
    closeWindow: vi.fn(),
    recentIds: [],
    presets: {},
    savePreset: vi.fn(),
    applyPreset: vi.fn(),
    hydrateFromServer: vi.fn(),
  });
  return { toggle, openWindow };
}

function renderSidebar(
  role?: "OWNER" | "STORYTELLER" | "CO_STORYTELLER" | "PLAYER" | "OBSERVER",
) {
  render(<EntitySidebar campaignId="camp-1" role={role} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EntitySidebar", () => {
  it("groups entities by type with a count per group", () => {
    setupQueries();
    setupDesktopWindows();
    renderSidebar("OWNER");

    expect(screen.getByText("Character · 2")).toBeInTheDocument();
    expect(screen.getByText("Location · 1")).toBeInTheDocument();
    expect(screen.getByText("Carlos Mendoza")).toBeInTheDocument();
    expect(screen.getByText("Beatriz Moreau")).toBeInTheDocument();
    expect(screen.getByText("Downtown")).toBeInTheDocument();
  });

  it("collapses and expands an entity type group when its header is clicked", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows();
    renderSidebar("OWNER");

    expect(screen.getByText("Carlos Mendoza")).toBeInTheDocument();

    const groupHeader = screen.getByRole("button", { name: "Character · 2" });
    expect(groupHeader).toHaveAttribute("aria-expanded", "true");

    await user.click(groupHeader);

    expect(groupHeader).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Carlos Mendoza")).not.toBeInTheDocument();
    expect(screen.getByText("Downtown")).toBeInTheDocument();

    await user.click(groupHeader);

    expect(groupHeader).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Carlos Mendoza")).toBeInTheDocument();
  });

  it("shows an empty state when the campaign has no entities", () => {
    setupQueries({ entities: [] });
    setupDesktopWindows();
    renderSidebar("OWNER");

    expect(screen.getByText("No entities yet.")).toBeInTheDocument();
  });

  it("opens an entity window for the clicked entity", async () => {
    const user = userEvent.setup();
    setupQueries();
    const { openWindow } = setupDesktopWindows();
    renderSidebar("OWNER");

    await user.click(screen.getByRole("button", { name: "Carlos Mendoza" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "entity:e-1", title: "Carlos Mendoza" }),
    );
  });

  it("toggles a world nav window when clicked", async () => {
    const user = userEvent.setup();
    setupQueries();
    const { toggle } = setupDesktopWindows();
    renderSidebar("OWNER");

    await user.click(screen.getByRole("button", { name: "Timeline" }));

    expect(toggle).toHaveBeenCalledWith("timeline");
  });

  it("hides quick actions for a non-writer role", () => {
    setupQueries();
    setupDesktopWindows();
    renderSidebar("PLAYER");

    expect(
      screen.queryByRole("button", { name: "New Entity" }),
    ).not.toBeInTheDocument();
  });

  it("opens a create-entity window when + New Entity is clicked, wired to refetch on save", async () => {
    const user = userEvent.setup();
    const { reexecute } = setupQueries();
    const { openWindow } = setupDesktopWindows();
    renderSidebar("OWNER");

    await user.click(screen.getByRole("button", { name: "New Entity" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "entity-form:new", title: "New Entity" }),
    );

    const request = openWindow.mock.calls[0][0] as OpenWindowRequest;
    const element = request.render() as {
      props: { campaignId: string; onCreated: () => void };
    };
    expect(element.props.campaignId).toBe("camp-1");
    element.props.onCreated();
    expect(reexecute).toHaveBeenCalledWith({ requestPolicy: "network-only" });
  });

  it("opens a create-note window when + New Note is clicked, and opens Notes on save if it was hidden", async () => {
    const user = userEvent.setup();
    setupQueries();
    const { openWindow, toggle } = setupDesktopWindows({ notesHidden: true });
    renderSidebar("OWNER");

    await user.click(screen.getByRole("button", { name: "New Note" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note-form:new", title: "New Note" }),
    );

    const request = openWindow.mock.calls[0][0] as OpenWindowRequest;
    const element = request.render() as {
      props: { campaignId: string; onSaved: () => void };
    };
    expect(element.props.campaignId).toBe("camp-1");
    element.props.onSaved();
    expect(toggle).toHaveBeenCalledWith("notes");
  });

  it("does not toggle Notes closed on save if it was already open", async () => {
    const user = userEvent.setup();
    setupQueries();
    const { openWindow, toggle } = setupDesktopWindows({ notesHidden: false });
    renderSidebar("OWNER");

    await user.click(screen.getByRole("button", { name: "New Note" }));

    const request = openWindow.mock.calls[0][0] as OpenWindowRequest;
    const element = request.render() as { props: { onSaved: () => void } };
    element.props.onSaved();

    expect(toggle).not.toHaveBeenCalled();
  });

  // KAN-133's "Open for player(s)…" trigger used to render per entity row
  // here; it now lives only in EntityWindow's Overview tab, where the
  // target picker has room. See ForceOpenEntityAction.
  it("does not render a force-open broadcast action in entity rows", () => {
    setupQueries();
    setupDesktopWindows();
    renderSidebar("OWNER");

    expect(
      screen.queryByRole("button", { name: "Open for player(s)…" }),
    ).not.toBeInTheDocument();
  });
});
