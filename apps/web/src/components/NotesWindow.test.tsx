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

const notes = [
  {
    id: "note-1",
    title: "Session 1 recap",
    content: "The party met **Goblin King** and fled the mines.",
  },
  {
    id: "note-2",
    title: "House rules",
    content: "No resting inside dungeons.",
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
      input: { campaignId: "camp-1", title: "New note title", content: "" },
    });
    expect(reexecuteNotes).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
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
});
