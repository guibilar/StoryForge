import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { NoteViewWindow } from "./NoteViewWindow";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  CampaignDocument,
  DeleteAttachmentDocument,
  MeDocument,
  NoteDocument,
  UploadNoteAttachmentDocument,
} from "../gql/graphql";
import { createDesktopWindowsStub } from "../lib/desktopWindowsStub";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
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

const playerMembers = [
  {
    userId: CURRENT_USER_ID,
    role: "PLAYER",
    user: { id: CURRENT_USER_ID, email: "player@example.com" },
  },
];

const NOTE = {
  id: "note-1",
  campaignId: "camp-1",
  authorId: CURRENT_USER_ID,
  title: "Ambush at the docks",
  content: "The [[Carlos Mendoza]] crew hit us near [[Downtown]].",
  visibility: "SHARED",
  recipientIds: [] as string[],
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-03T00:00:00.000Z",
  linkedEntities: [
    {
      id: "e-1",
      name: "Carlos Mendoza",
      type: "Character",
      category: "CHARACTER",
      description: "A Tremere regent",
      image: null,
      color: null,
      visibility: "PUBLIC",
    },
    {
      id: "e-2",
      name: "Downtown",
      type: "Location",
      category: "LOCATION",
      description: null,
      image: null,
      color: null,
      visibility: "PUBLIC",
    },
  ],
  linkedNotes: [] as { id: string; title: string }[],
  children: [] as {
    id: string;
    authorId: string;
    title: string;
    content: string;
    visibility: string;
  }[],
  backlinks: [{ id: "note-2", title: "Session 4 recap" }],
  attachments: [
    {
      id: "att-1",
      url: "/uploads/note-1/map.png",
      fileName: "map.png",
      mimeType: "image/png",
      sizeBytes: 2048,
      createdAt: "2026-02-02T00:00:00.000Z",
    },
  ],
};

function setupMocks({
  members = ownerMembers,
  note = NOTE,
  uploadAttachment = vi
    .fn()
    .mockResolvedValue({ data: { uploadNoteAttachment: { id: "att-2" } } }),
  deleteAttachment = vi
    .fn()
    .mockResolvedValue({ data: { deleteAttachment: true } }),
  reexecuteNote = vi.fn(),
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
    if (args.query === NoteDocument) {
      return [{ data: { note }, fetching: false, stale: false }, reexecuteNote];
    }
    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === UploadNoteAttachmentDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        uploadAttachment,
      ];
    }
    if (document === DeleteAttachmentDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        deleteAttachment,
      ];
    }
    throw new Error("Unexpected mutation in test");
  }) as never);

  return { uploadAttachment, deleteAttachment, reexecuteNote };
}

function setupDesktopWindows() {
  const openWindow = vi.fn();
  vi.mocked(useDesktopWindows).mockReturnValue(
    createDesktopWindowsStub({ openWindow }),
  );
  return { openWindow };
}

function renderWindow() {
  const chromeApi = { setLoading: vi.fn(), setOnRefresh: vi.fn() };
  render(
    <WindowChromeContext.Provider value={chromeApi}>
      <NoteViewWindow noteId="note-1" campaignId="camp-1" />
    </WindowChromeContext.Provider>,
  );
  return chromeApi;
}

describe("NoteViewWindow", () => {
  it("renders the note as a page, with its title and rendered body", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("heading", { name: "Ambush at the docks" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Carlos Mendoza" }),
    ).toBeInTheDocument();
  });

  it("opens the entity window when an inline [[link]] is followed", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("link", { name: "Downtown" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "entity:e-2", title: "Downtown" }),
    );
  });

  it("opens a note window from a backlink", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "Session 4 recap" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note:note-2", title: "Session 4 recap" }),
    );
  });

  it("opens the separate edit window rather than editing in place", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "Edit note" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "note-form:note-1",
        title: "Edit: Ambush at the docks",
      }),
    );
  });

  it("lists attachments with a link to the stored file", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByText("map.png")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /map\.png/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/uploads/note-1/map.png"),
    );
  });

  it("uploads an attachment and refetches the note", async () => {
    const { uploadAttachment, reexecuteNote } = setupMocks();
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    const file = new File(["x"], "handout.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Attachment file"), file);

    expect(uploadAttachment).toHaveBeenCalledWith({ noteId: "note-1", file });
    expect(reexecuteNote).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("rejects a file over the 5MB store limit before uploading it", async () => {
    const { uploadAttachment } = setupMocks();
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    const large = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(large, "size", { value: 6 * 1024 * 1024 });
    await user.upload(screen.getByLabelText("Attachment file"), large);

    expect(uploadAttachment).not.toHaveBeenCalled();
    expect(
      screen.getByText("File size exceeds the maximum limit of 5MB."),
    ).toBeInTheDocument();
  });

  it("deletes an attachment and refetches", async () => {
    const { deleteAttachment, reexecuteNote } = setupMocks();
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(
      screen.getByRole("button", { name: "Delete attachment map.png" }),
    );

    expect(deleteAttachment).toHaveBeenCalledWith({ id: "att-1" });
    expect(reexecuteNote).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("hides editing and attachment controls from a player who does not own the note", () => {
    setupMocks({
      members: playerMembers,
      note: { ...NOTE, authorId: "someone-else" },
    });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.queryByRole("button", { name: "Edit note" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Attach image" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Delete attachment/ }),
    ).not.toBeInTheDocument();
    // Reading is still allowed.
    expect(
      screen.getByRole("heading", { name: "Ambush at the docks" }),
    ).toBeInTheDocument();
  });

  it("lets a player file a sub-note under a note they can only read", async () => {
    setupMocks({
      members: playerMembers,
      note: { ...NOTE, authorId: "someone-else" },
    });
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    // They can't edit it...
    expect(
      screen.queryByRole("button", { name: "Edit note" }),
    ).not.toBeInTheDocument();
    // ...but they can annotate it, which the API allows on view rights.
    await user.click(screen.getByRole("button", { name: "Add sub-note" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "note-form:new:child-note-1",
        title: "New note under: Ambush at the docks",
      }),
    );
  });

  it("lists existing sub-notes and opens one when clicked", async () => {
    setupMocks({
      note: {
        ...NOTE,
        children: [
          {
            id: "note-3",
            authorId: CURRENT_USER_ID,
            title: "My theory about the docks",
            content: "private thoughts",
            visibility: "PRIVATE",
          },
        ],
      },
    });
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(
      screen.getByRole("button", { name: "My theory about the docks" }),
    );

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note:note-3" }),
    );
  });

  it("hides the sub-note action from an Observer", () => {
    setupMocks({
      members: [
        {
          userId: CURRENT_USER_ID,
          role: "OBSERVER",
          user: { id: CURRENT_USER_ID, email: "observer@example.com" },
        },
      ],
      note: { ...NOTE, authorId: "someone-else" },
    });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.queryByRole("button", { name: "Add sub-note" }),
    ).not.toBeInTheDocument();
  });

  it("lets a player manage their own note", () => {
    setupMocks({ members: playerMembers });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "Edit note" }),
    ).toBeInTheDocument();
  });
});
