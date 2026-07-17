import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { AppCommandPalette } from "./AppCommandPalette";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import {
  CreateEntityDocument,
  CreateNoteDocument,
  EntitiesDocument,
  NotesDocument,
  SessionsDocument,
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
    name: "Downtown",
    type: "Location",
    description: null,
    visibility: "PUBLIC",
  },
];

const NOTES = [
  {
    id: "n-1",
    campaignId: "camp-1",
    authorId: "user-1",
    title: "Council Meeting",
    content: "The council gathered to discuss the breach.",
    visibility: "SHARED",
    recipientIds: [],
    createdAt: "2024-05-12",
    updatedAt: "2024-05-12",
  },
];

const SESSIONS = [
  {
    id: "s-1",
    sessionNumber: 3,
    date: "2024-05-12",
    summary: "The Sabbat attacked downtown.",
    attendees: [],
  },
];

function setupQueries() {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === EntitiesDocument) {
      return [
        { data: { entities: ENTITIES }, fetching: false, stale: false },
        vi.fn(),
      ];
    }
    if (args.query === NotesDocument) {
      return [
        { data: { noteRoots: NOTES }, fetching: false, stale: false },
        vi.fn(),
      ];
    }
    if (args.query === SessionsDocument) {
      return [
        { data: { sessions: SESSIONS }, fetching: false, stale: false },
        vi.fn(),
      ];
    }
    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((doc: unknown) => {
    if (doc === CreateEntityDocument || doc === CreateNoteDocument) {
      return [{ fetching: false, stale: false }, vi.fn()];
    }
    throw new Error("Unexpected mutation in test");
  }) as never);
}

function setupDesktopWindows({ recentIds = [] as string[] } = {}) {
  const toggle = vi.fn();
  const openWindow = vi.fn();
  vi.mocked(useDesktopWindows).mockReturnValue({
    layout: {},
    bringToFront: vi.fn(),
    toggle,
    startDrag: vi.fn(),
    startResize: vi.fn(),
    reset: vi.fn(),
    dynamicWindows: {},
    openWindow,
    closeWindow: vi.fn(),
    recentIds,
    presets: {},
    savePreset: vi.fn(),
    applyPreset: vi.fn(),
    hydrateFromServer: vi.fn(),
  });
  return { toggle, openWindow };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AppCommandPalette", () => {
  it("is closed until Cmd+K/Ctrl+K is pressed", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows();
    render(<AppCommandPalette campaignId="camp-1" role="OWNER" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.keyboard("{Meta>}k{/Meta}");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows();
    render(<AppCommandPalette campaignId="camp-1" role="OWNER" />);

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows entities, notes, and sessions as results", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows();
    render(<AppCommandPalette campaignId="camp-1" role="OWNER" />);

    await user.keyboard("{Meta>}k{/Meta}");

    expect(screen.getByText("Carlos Mendoza")).toBeInTheDocument();
    expect(screen.getByText("Council Meeting")).toBeInTheDocument();
    expect(screen.getByText("Session 3")).toBeInTheDocument();
  });

  it("filters results by the typed query", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows();
    render(<AppCommandPalette campaignId="camp-1" role="OWNER" />);

    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(screen.getByRole("combobox"), "council");

    expect(screen.getByText("Council Meeting")).toBeInTheDocument();
    expect(screen.queryByText("Carlos Mendoza")).not.toBeInTheDocument();
  });

  it("opens an entity's window when an entity result is selected", async () => {
    const user = userEvent.setup();
    setupQueries();
    const { openWindow } = setupDesktopWindows();
    render(<AppCommandPalette campaignId="camp-1" role="OWNER" />);

    await user.keyboard("{Meta>}k{/Meta}");
    await user.click(screen.getByText("Carlos Mendoza"));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "entity:e-1", title: "Carlos Mendoza" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a Recent section for previously-opened entities", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows({ recentIds: ["e-1"] });
    render(<AppCommandPalette campaignId="camp-1" role="OWNER" />);

    await user.keyboard("{Meta>}k{/Meta}");

    // "Carlos Mendoza" now appears twice — once under Recent, once under
    // Entities — since recentIds and the full entity list overlap.
    expect(screen.getAllByText("Carlos Mendoza")).toHaveLength(2);
  });

  it("opens the entity's window from the Recent section (distinct item id from the Entities section)", async () => {
    const user = userEvent.setup();
    setupQueries();
    const { openWindow } = setupDesktopWindows({ recentIds: ["e-1"] });
    render(<AppCommandPalette campaignId="camp-1" role="OWNER" />);

    await user.keyboard("{Meta>}k{/Meta}");
    const [recentResult] = screen.getAllByText("Carlos Mendoza");
    await user.click(recentResult);

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "entity:e-1", title: "Carlos Mendoza" }),
    );
  });

  it("does not show a Recent section when nothing has been opened yet", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows({ recentIds: [] });
    render(<AppCommandPalette campaignId="camp-1" role="OWNER" />);

    await user.keyboard("{Meta>}k{/Meta}");

    expect(screen.getAllByText("Carlos Mendoza")).toHaveLength(1);
  });

  it("toggles the Notes window when a note result is selected", async () => {
    const user = userEvent.setup();
    setupQueries();
    const { toggle } = setupDesktopWindows();
    render(<AppCommandPalette campaignId="camp-1" role="OWNER" />);

    await user.keyboard("{Meta>}k{/Meta}");
    await user.click(screen.getByText("Council Meeting"));

    expect(toggle).toHaveBeenCalledWith("notes");
  });

  it("toggles the Sessions window when a session result is selected", async () => {
    const user = userEvent.setup();
    setupQueries();
    const { toggle } = setupDesktopWindows();
    render(<AppCommandPalette campaignId="camp-1" role="OWNER" />);

    await user.keyboard("{Meta>}k{/Meta}");
    await user.click(screen.getByText("Session 3"));

    expect(toggle).toHaveBeenCalledWith("sessions");
  });

  it("shows New Entity/New Note actions for a writer and opens the create form", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows();
    render(<AppCommandPalette campaignId="camp-1" role="OWNER" />);

    await user.keyboard("{Meta>}k{/Meta}");
    expect(
      screen.getByRole("option", { name: /^New Entity/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^New Note/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /^New Entity/ }));

    // The palette itself closes on commit, leaving only the now-open
    // CreateEntityModal's heading — unambiguous once the option is gone.
    expect(
      screen.getByRole("heading", { name: "New Entity" }),
    ).toBeInTheDocument();
  });

  it("hides Actions for a non-writer role", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows();
    render(<AppCommandPalette campaignId="camp-1" role="PLAYER" />);

    await user.keyboard("{Meta>}k{/Meta}");

    expect(
      screen.queryByRole("option", { name: /^New Entity/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /^New Note/ }),
    ).not.toBeInTheDocument();
  });
});
