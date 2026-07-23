import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { NoteFormWindow } from "./NoteFormWindow";
import type { NoteRow } from "./NoteFormWindow";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  CampaignDocument,
  CreateNoteDocument,
  EntitiesDocument,
  MeDocument,
  NotesDocument,
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

// Targets offered by the [[link]] pickers above the editor.
const LINKABLE_ENTITIES = [
  { id: "e-1", name: "Carlos Mendoza", type: "Character" },
  { id: "e-2", name: "Downtown", type: "Location" },
];

const LINKABLE_NOTES = [{ id: "note-9", title: "Session 1 recap" }];

function setupMocks({
  members = ownerMembers,
  entities = LINKABLE_ENTITIES,
  noteRoots = LINKABLE_NOTES,
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

    if (args.query === EntitiesDocument) {
      return [{ data: { entities }, fetching: false, stale: false }, vi.fn()];
    }

    if (args.query === NotesDocument) {
      return [{ data: { noteRoots }, fetching: false, stale: false }, vi.fn()];
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

function renderCreateWithSeed(
  initial: Partial<NoteRow>,
  onSaved = vi.fn(),
  onClose = vi.fn(),
) {
  render(
    <NoteFormWindow
      campaignId="camp-1"
      mode={{ mode: "create", key: "seeded", initial }}
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

describe("NoteFormWindow editor", () => {
  it("offers a [[link]] toolbar button alongside the markdown basics", () => {
    setupMocks();
    renderCreate();

    expect(
      screen.getByRole("button", { name: "Insert a [[link]]" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Add bold text/)).toBeInTheDocument();
    // Trimmed from the stock toolbar: images are attachments on the view
    // window, so a markdown image button would promise an upload path that
    // doesn't exist here.
    expect(screen.queryByLabelText(/image/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/table/i)).not.toBeInTheDocument();
  });

  it("wraps the caret in brackets when the [[link]] button is used", async () => {
    const { createNote } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Title"), "Ambush");
    await user.click(screen.getByRole("button", { name: "Insert a [[link]]" }));

    const textarea = screen.getByLabelText("Content") as HTMLTextAreaElement;
    expect(textarea.value).toBe("[[]]");
    // Caret parked between the brackets, ready for the target's name.
    expect(textarea.selectionStart).toBe(2);
    expect(textarea.selectionEnd).toBe(2);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(createNote).toHaveBeenCalledWith({
      input: expect.objectContaining({ content: "[[]]" }),
    });
  });

  it("hints the [[ ]] syntax in the empty editor", () => {
    setupMocks();
    renderCreate();

    expect(
      screen.getByPlaceholderText(
        "Write your note… use [[ ]] to link an entity or another note.",
      ),
    ).toBeInTheDocument();
  });
});

describe("NoteFormWindow create seeds", () => {
  it("files the note under the seeded parent", async () => {
    const { createNote } = setupMocks();
    const user = userEvent.setup();
    renderCreateWithSeed({ parentNoteId: "note-1", visibility: "PRIVATE" });

    await user.type(screen.getByLabelText("Title"), "My theory");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createNote).toHaveBeenCalledWith({
      input: expect.objectContaining({
        parentNoteId: "note-1",
        visibility: "PRIVATE",
      }),
    });
  });

  it("starts a note seeded from an entity with the [[link]] already written", async () => {
    const { createNote } = setupMocks();
    const user = userEvent.setup();
    renderCreateWithSeed({
      content: "[[Carlos Mendoza|entity:e-1]]\n\n",
      visibility: "PRIVATE",
    });

    await user.type(screen.getByLabelText("Title"), "What I saw");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createNote).toHaveBeenCalledWith({
      input: expect.objectContaining({
        content: "[[Carlos Mendoza|entity:e-1]]\n\n",
        visibility: "PRIVATE",
      }),
    });
  });

  it("omits parentNoteId entirely for an unseeded create", async () => {
    const { createNote } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Title"), "Loose note");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createNote.mock.calls[0][0].input).not.toHaveProperty(
      "parentNoteId",
    );
  });
});

describe("NoteFormWindow link pickers", () => {
  it("inserts an entity [[link]] with the id pinned — the note's only way to relate to an entity", async () => {
    const { createNote } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Title"), "Ambush");
    await user.selectOptions(
      screen.getByLabelText("Insert a link to an entity"),
      "e-1",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createNote).toHaveBeenCalledWith({
      input: expect.objectContaining({
        content: "[[Carlos Mendoza|entity:e-1]]",
      }),
    });
  });

  it("inserts a note link", async () => {
    const { createNote } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Title"), "Ambush");
    await user.selectOptions(
      screen.getByLabelText("Insert a link to another note"),
      "note-9",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createNote).toHaveBeenCalledWith({
      input: expect.objectContaining({
        content: "[[Session 1 recap|note:note-9]]",
      }),
    });
  });

  it("does not offer the note being edited as a link target", () => {
    setupMocks({
      noteRoots: [
        { id: "note-1", title: "This note" },
        { id: "note-9", title: "Session 1 recap" },
      ],
    });
    renderEdit({
      id: "note-1",
      authorId: CURRENT_USER_ID,
      title: "This note",
      content: "",
      visibility: "SHARED",
      recipientIds: [],
    });

    const picker = screen.getByLabelText("Insert a link to another note");
    expect(within(picker).queryByText("This note")).not.toBeInTheDocument();
    expect(within(picker).getByText("Session 1 recap")).toBeInTheDocument();
  });
});

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
