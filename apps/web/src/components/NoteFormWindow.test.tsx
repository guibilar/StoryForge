import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { NoteFormWindow } from "./NoteFormWindow";
import type { NoteRow } from "./NoteFormWindow";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  CampaignDocument,
  CreateNoteDocument,
  MeDocument,
  UpdateNoteDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

const CURRENT_USER_ID = "user-1";

const ownerMembers = [
  {
    userId: CURRENT_USER_ID,
    role: "OWNER",
    user: { id: CURRENT_USER_ID, email: "owner@example.com" },
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

function setupMocks({
  members = ownerMembers,
  createNote = vi.fn().mockResolvedValue({ data: { createNote: {} } }),
  updateNote = vi.fn().mockResolvedValue({ data: { updateNote: {} } }),
  createFetching = false,
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

    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === CreateNoteDocument) {
      return [
        { fetching: createFetching, error: undefined, stale: false },
        createNote,
      ];
    }
    if (document === UpdateNoteDocument) {
      return [{ fetching: false, error: undefined, stale: false }, updateNote];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { createNote, updateNote };
}

function renderCreate(onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <NoteFormWindow
      campaignId="camp-1"
      mode={{ mode: "create" }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

function renderEdit(note: NoteRow, onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <NoteFormWindow
      campaignId="camp-1"
      mode={{ mode: "edit", item: note }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

describe("NoteFormWindow", () => {
  it("creates a note and calls onSaved/onClose", async () => {
    const { createNote } = setupMocks();
    const user = userEvent.setup();
    const { onSaved, onClose } = renderCreate();

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
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("creates a targeted handout with selected recipients", async () => {
    const { createNote } = setupMocks({ members: tableMembers });
    const user = userEvent.setup();
    renderCreate();

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
    renderCreate();

    await user.selectOptions(
      screen.getByLabelText("Visibility"),
      "Handout for specific players",
    );

    expect(
      screen.queryByLabelText("owner@example.com"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("player1@example.com")).toBeInTheDocument();
  });

  it("lets a player create a note without the Handout visibility option (KAN-90)", async () => {
    const { createNote } = setupMocks({ members: playerMembers });
    const user = userEvent.setup();
    renderCreate();

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

  it("seeds the edit form with the note's visibility and recipients, and submits them", async () => {
    const targeted: NoteRow = {
      id: "note-3",
      authorId: CURRENT_USER_ID,
      title: "Handout",
      content: "For your eyes only.",
      visibility: "TARGETED",
      recipientIds: ["player-1"],
    };
    const { updateNote } = setupMocks({ members: tableMembers });
    const user = userEvent.setup();
    renderEdit(targeted);

    expect(screen.getByLabelText("Title")).toHaveValue("Handout");
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

  it("omits visibility from the update when it is unchanged", async () => {
    const targeted: NoteRow = {
      id: "note-7",
      authorId: CURRENT_USER_ID,
      title: "Handout",
      content: "psst",
      visibility: "TARGETED",
      recipientIds: ["player-1"],
    };
    const { updateNote } = setupMocks({ members: tableMembers });
    const user = userEvent.setup();
    renderEdit(targeted);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateNote).toHaveBeenCalledWith({
      input: { id: "note-7", title: "Handout", content: "psst" },
    });
  });

  it("calls onClose without saving when Cancel is clicked", async () => {
    const { createNote } = setupMocks();
    const user = userEvent.setup();
    const { onClose, onSaved } = renderCreate();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(createNote).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports loading to the window chrome while a save is in flight", () => {
    setupMocks({ createFetching: true });
    const chromeApi = { setLoading: vi.fn(), setOnRefresh: vi.fn() };
    render(
      <WindowChromeContext.Provider value={chromeApi}>
        <NoteFormWindow
          campaignId="camp-1"
          mode={{ mode: "create" }}
          onSaved={vi.fn()}
          onClose={vi.fn()}
        />
      </WindowChromeContext.Provider>,
    );

    expect(chromeApi.setLoading).toHaveBeenCalledWith(true);
    // Forms don't register a refresh callback — the updater resolves to
    // undefined since NoteFormWindow calls useWindowChromeSync(isLoading)
    // with no second argument.
    const registered = chromeApi.setOnRefresh.mock.calls.at(-1)?.[0]() as
      (() => void) | undefined;
    expect(registered).toBeUndefined();
  });
});
