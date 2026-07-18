import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { NotesWindow } from "./NotesWindow";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  CampaignDocument,
  DeleteNoteDocument,
  MeDocument,
  NotesDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ id: "camp-1" }) };
});

vi.mock("../lib/DesktopWindowsContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/DesktopWindowsContext")>();
  return { ...actual, useDesktopWindows: vi.fn() };
});

const CURRENT_USER_ID = "user-1";

const ownerMembers = [
  {
    userId: CURRENT_USER_ID,
    role: "OWNER",
    user: { id: CURRENT_USER_ID, email: "owner@example.com" },
  },
];

const storytellerMembers = [
  {
    userId: CURRENT_USER_ID,
    role: "STORYTELLER",
    user: { id: CURRENT_USER_ID, email: "storyteller@example.com" },
  },
];

const tableMembers = [
  ...ownerMembers,
  {
    userId: "player-1",
    role: "PLAYER",
    user: { id: "player-1", email: "player1@example.com" },
  },
  {
    userId: "player-2",
    role: "PLAYER",
    user: { id: "player-2", email: "player2@example.com" },
  },
];

const playerMembers = tableMembers.map((member) =>
  member.userId === CURRENT_USER_ID ? { ...member, role: "PLAYER" } : member,
);

interface NoteFixture {
  id: string;
  authorId: string;
  title: string;
  content: string;
  visibility: string;
  recipientIds: string[];
}

const notes: NoteFixture[] = [
  {
    id: "note-1",
    authorId: CURRENT_USER_ID,
    title: "Session 1 recap",
    content: "The party met **Goblin King** and fled the mines.",
    visibility: "SHARED",
    recipientIds: [],
  },
  {
    id: "note-2",
    authorId: "someone-else",
    title: "House rules",
    content: "No resting inside dungeons.",
    visibility: "SHARED",
    recipientIds: [],
  },
];

function setupMocks({
  members = ownerMembers,
  noteRoots = notes,
  deleteNote = vi.fn().mockResolvedValue({ data: { deleteNote: true } }),
  reexecuteNotes = vi.fn(),
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === MeDocument) {
      return [
        {
          data: { me: { id: CURRENT_USER_ID, email: "member@example.com" } },
          fetching: false,
          stale: false,
        },
        vi.fn(),
      ];
    }

    if (args.query === CampaignDocument) {
      return [
        {
          data: { campaign: { id: "camp-1", name: "Campaign", members } },
          fetching: false,
          stale: false,
        },
        vi.fn(),
      ];
    }

    if (args.query === NotesDocument) {
      return [
        {
          data: { noteRoots },
          fetching: false,
          stale: false,
        },
        reexecuteNotes,
      ];
    }

    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === DeleteNoteDocument) {
      return [{ fetching: false, error: undefined, stale: false }, deleteNote];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { deleteNote, reexecuteNotes };
}

function setupDesktopWindows() {
  const openWindow = vi.fn();
  const closeWindow = vi.fn();
  vi.mocked(useDesktopWindows).mockReturnValue({
    layout: {},
    bringToFront: vi.fn(),
    toggle: vi.fn(),
    startDrag: vi.fn(),
    startResize: vi.fn(),
    reset: vi.fn(),
    dynamicWindows: {},
    openWindow,
    closeWindow,
    recentIds: [],
    presets: {},
    savePreset: vi.fn(),
    applyPreset: vi.fn(),
    hydrateFromServer: vi.fn(),
  });
  return { openWindow, closeWindow };
}

function renderWindow() {
  const chromeApi = { setLoading: vi.fn(), setOnRefresh: vi.fn() };
  render(
    <WindowChromeContext.Provider value={chromeApi}>
      <MemoryRouter>
        <NotesWindow />
      </MemoryRouter>
    </WindowChromeContext.Provider>,
  );
  return chromeApi;
}

describe("NotesWindow", () => {
  it("lists notes with title and a truncated preview", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByText("Session 1 recap")).toBeInTheDocument();
    expect(screen.getByText("House rules")).toBeInTheDocument();
    expect(
      screen.getByText("The party met **Goblin King** and fled the mines."),
    ).toBeInTheDocument();
  });

  it("shows create controls for an Owner", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "+ New note" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("shows create controls for a Storyteller", () => {
    setupMocks({ members: storytellerMembers });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "+ New note" }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no notes", () => {
    setupMocks({ noteRoots: [] });
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByText("No notes yet.")).toBeInTheDocument();
  });

  it("opens a create window when + New note is clicked", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ New note" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note-form:new", title: "New Note" }),
    );
  });

  it("opens an edit window when a modifiable note is clicked", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByText("Session 1 recap"));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "note-form:note-1",
        title: "Edit: Session 1 recap",
      }),
    );
  });

  it("shows visibility badges: Private, Handout count, and For you", () => {
    const badgeNotes = [
      { ...notes[0] },
      {
        id: "note-4",
        authorId: "someone-else",
        title: "GM secrets",
        content: "hidden",
        visibility: "PRIVATE",
        recipientIds: [],
      },
      {
        id: "note-5",
        authorId: "someone-else",
        title: "Clue for players",
        content: "psst",
        visibility: "TARGETED",
        recipientIds: ["player-1", "player-2"],
      },
    ];
    setupMocks({ members: tableMembers, noteRoots: badgeNotes });
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Handout · 2")).toBeInTheDocument();
  });

  it("labels a handout addressed to the current user as For you", () => {
    const handout = {
      id: "note-6",
      authorId: "someone-else",
      title: "Just for me",
      content: "psst",
      visibility: "TARGETED",
      recipientIds: [CURRENT_USER_ID],
    };
    setupMocks({ members: playerMembers, noteRoots: [handout] });
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByText("For you")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ New note" }),
    ).toBeInTheDocument();
  });

  it("deletes a note after confirming and refetches", async () => {
    const { deleteNote, reexecuteNotes } = setupMocks();
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(deleteNote).toHaveBeenCalledWith({ id: "note-1" });
    expect(reexecuteNotes).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("shows edit/delete only on a player's own notes (KAN-90)", () => {
    const ownNote: NoteFixture = {
      id: "note-own",
      authorId: CURRENT_USER_ID,
      title: "My journal",
      content: "mine",
      visibility: "PRIVATE",
      recipientIds: [],
    };
    const gmNote: NoteFixture = {
      id: "note-gm",
      authorId: "someone-else",
      title: "Party log",
      content: "shared",
      visibility: "SHARED",
      recipientIds: [],
    };
    setupMocks({ members: playerMembers, noteRoots: [ownNote, gmNote] });
    setupDesktopWindows();
    renderWindow();

    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);

    const ownRow = screen.getByText("My journal").closest("button");
    const gmRow = screen.getByText("Party log").closest("button");
    expect(ownRow).toBeEnabled();
    expect(gmRow).toBeDisabled();
  });

  it("reports its loading state and a network-only refresh to the window chrome", () => {
    const { reexecuteNotes } = setupMocks();
    setupDesktopWindows();
    const chromeApi = renderWindow();

    expect(chromeApi.setLoading).toHaveBeenCalledWith(false);
    const registered = chromeApi.setOnRefresh.mock.calls.at(-1)?.[0]() as
      (() => void) | undefined;
    registered?.();

    expect(reexecuteNotes).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });
});
