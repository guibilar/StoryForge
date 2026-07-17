import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { EntitySidebar } from "./EntitySidebar";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import {
  CreateEntityDocument,
  CreateNoteDocument,
  EntitiesDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
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

function setupQueries({
  entities = ENTITIES,
  createEntity = vi.fn().mockResolvedValue({ data: { createEntity: {} } }),
  createNote = vi.fn().mockResolvedValue({ data: { createNote: {} } }),
  reexecute = vi.fn(),
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === EntitiesDocument) {
      return [{ data: { entities }, fetching: false, stale: false }, reexecute];
    }
    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((doc: unknown) => {
    if (doc === CreateEntityDocument) {
      return [{ fetching: false, stale: false }, createEntity];
    }
    if (doc === CreateNoteDocument) {
      return [{ fetching: false, stale: false }, createNote];
    }
    throw new Error("Unexpected mutation in test");
  }) as never);

  return { createEntity, createNote, reexecute };
}

function setupDesktopWindows() {
  const toggle = vi.fn();
  const openWindow = vi.fn();
  const hiddenLayout = Object.fromEntries(
    ["timeline", "sessions", "notes", "members", "relationships"].map((id) => [
      id,
      { x: 0, y: 0, width: 0, height: 0, hidden: true, z: 0 },
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
  });
  return { toggle, openWindow };
}

function renderSidebar(role?: "OWNER" | "STORYTELLER" | "PLAYER") {
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
      screen.queryByRole("button", { name: "+ New Entity" }),
    ).not.toBeInTheDocument();
  });

  it("creates a new entity via the quick action and refetches", async () => {
    const user = userEvent.setup();
    const { createEntity, reexecute } = setupQueries();
    setupDesktopWindows();
    renderSidebar("OWNER");

    await user.click(screen.getByRole("button", { name: "+ New Entity" }));
    await user.type(screen.getByLabelText("Name"), "Lucien Dubois");
    await user.type(screen.getByLabelText("Type"), "Character");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(createEntity).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        type: "Character",
        name: "Lucien Dubois",
        description: null,
        visibility: "PUBLIC",
      },
    });
    expect(reexecute).toHaveBeenCalledWith({ requestPolicy: "network-only" });
  });

  it("creates a new note via the quick action and opens the Notes window", async () => {
    const user = userEvent.setup();
    const { createNote } = setupQueries();
    const { toggle } = setupDesktopWindows();
    renderSidebar("OWNER");

    await user.click(screen.getByRole("button", { name: "+ New Note" }));
    await user.type(screen.getByLabelText("Title"), "Council Meeting");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(createNote).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        title: "Council Meeting",
        content: null,
        visibility: "SHARED",
      },
    });
    expect(toggle).toHaveBeenCalledWith("notes");
  });
});
