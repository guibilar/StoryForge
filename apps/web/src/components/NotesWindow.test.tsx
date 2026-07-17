import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { NotesWindow } from "./NotesWindow";
import {
  CampaignDocument,
  CreateNoteDocument,
  DeleteNoteDocument,
  MeDocument,
  NotesDocument,
  UpdateNoteDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ id: "camp-1" }) };
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
  createNote = vi.fn().mockResolvedValue({ data: { createNote: {} } }),
  updateNote = vi.fn().mockResolvedValue({ data: { updateNote: {} } }),
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
    if (document === CreateNoteDocument) {
      return [{ fetching: false, error: undefined, stale: false }, createNote];
    }
    if (document === UpdateNoteDocument) {
      return [{ fetching: false, error: undefined, stale: false }, updateNote];
    }
    if (document === DeleteNoteDocument) {
      return [{ fetching: false, error: undefined, stale: false }, deleteNote];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { createNote, updateNote, deleteNote, reexecuteNotes };
}

function renderWindow() {
  render(
    <MemoryRouter>
      <NotesWindow />
    </MemoryRouter>,
  );
}

describe("NotesWindow", () => {
  it("lists notes with title and a truncated preview", () => {
    setupMocks();
    renderWindow();

    expect(screen.getByText("Session 1 recap")).toBeInTheDocument();
    expect(screen.getByText("House rules")).toBeInTheDocument();
    expect(
      screen.getByText("The party met **Goblin King** and fled the mines."),
    ).toBeInTheDocument();
  });

  it("shows create controls for an Owner", () => {
    setupMocks();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "+ New note" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("shows create controls for a Storyteller", () => {
    setupMocks({ members: storytellerMembers });
    renderWindow();

    expect(
      screen.getByRole("button", { name: "+ New note" }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no notes", () => {
    setupMocks({ noteRoots: [] });
    renderWindow();

    expect(screen.getByText("No notes yet.")).toBeInTheDocument();
  });

  it("creates a note via the modal form and refetches", async () => {
    const { createNote, reexecuteNotes } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ New note" }));
    await user.type(screen.getByLabelText("Title"), "New note title");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createNote).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        title: "New note title",
        content: "",
        visibility: "SHARED",
      },
    });
    expect(reexecuteNotes).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("creates a targeted handout with selected recipients", async () => {
    const { createNote } = setupMocks({ members: tableMembers });
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ New note" }));
    await user.type(screen.getByLabelText("Title"), "Secret clue");
    await user.selectOptions(
      screen.getByLabelText("Visibility"),
      "Handout for specific players",
    );

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
    expect(
      screen.getByText("Select at least one recipient."),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText("player1@example.com"));
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    expect(createNote).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        title: "Secret clue",
        content: "",
        visibility: "TARGETED",
        recipientIds: ["player-1"],
      },
    });
  });

  it("does not offer the current user as a recipient", async () => {
    setupMocks({ members: tableMembers });
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ New note" }));
    await user.selectOptions(
      screen.getByLabelText("Visibility"),
      "Handout for specific players",
    );

    expect(
      screen.queryByLabelText("owner@example.com"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("player1@example.com")).toBeInTheDocument();
  });

  it("seeds the edit modal with the note's visibility and recipients, and submits them", async () => {
    const targeted = {
      id: "note-3",
      authorId: CURRENT_USER_ID,
      title: "Handout",
      content: "For your eyes only.",
      visibility: "TARGETED",
      recipientIds: ["player-1"],
    };
    const { updateNote } = setupMocks({
      members: tableMembers,
      noteRoots: [targeted],
    });
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByText("Handout"));

    expect(screen.getByLabelText("Visibility")).toHaveValue("TARGETED");
    expect(screen.getByLabelText("player1@example.com")).toBeChecked();

    await user.click(screen.getByLabelText("player2@example.com"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateNote).toHaveBeenCalledWith({
      input: {
        id: "note-3",
        title: "Handout",
        content: "For your eyes only.",
        visibility: "TARGETED",
        recipientIds: ["player-1", "player-2"],
      },
    });
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
    renderWindow();

    expect(screen.getByText("For you")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ New note" }),
    ).toBeInTheDocument();
  });

  it("deletes a note after confirming and refetches", async () => {
    const { deleteNote, reexecuteNotes } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(deleteNote).toHaveBeenCalledWith({ id: "note-1" });
    expect(reexecuteNotes).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("lets a player create a note without the Handout visibility option (KAN-90)", async () => {
    const { createNote } = setupMocks({
      members: playerMembers,
      noteRoots: [],
    });
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ New note" }));

    const visibilitySelect = screen.getByLabelText("Visibility");
    expect(visibilitySelect).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Handout for specific players" }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Title"), "My journal");
    await user.selectOptions(
      visibilitySelect,
      "Private (you and Storytellers)",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createNote).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        title: "My journal",
        content: "",
        visibility: "PRIVATE",
      },
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
    renderWindow();

    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);

    const ownRow = screen.getByText("My journal").closest("button");
    const gmRow = screen.getByText("Party log").closest("button");
    expect(ownRow).toBeEnabled();
    expect(gmRow).toBeDisabled();
  });

  it("omits visibility from the update when it is unchanged", async () => {
    const targeted: NoteFixture = {
      id: "note-7",
      authorId: CURRENT_USER_ID,
      title: "Handout",
      content: "psst",
      visibility: "TARGETED",
      recipientIds: ["player-1"],
    };
    const { updateNote } = setupMocks({
      members: tableMembers,
      noteRoots: [targeted],
    });
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByText("Handout"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateNote).toHaveBeenCalledWith({
      input: { id: "note-7", title: "Handout", content: "psst" },
    });
  });
});
