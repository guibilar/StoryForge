import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { SessionsWindow } from "./SessionsWindow";
import {
  AttachSessionAttendeeDocument,
  CampaignDocument,
  CreateSessionDocument,
  DeleteSessionDocument,
  DetachSessionAttendeeDocument,
  MeDocument,
  SessionsDocument,
  UpdateSessionDocument,
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
const OTHER_USER_ID = "user-2";

const ownerMembers = [
  {
    userId: CURRENT_USER_ID,
    role: "OWNER",
    user: { id: CURRENT_USER_ID, email: "owner@example.com" },
  },
  {
    userId: OTHER_USER_ID,
    role: "PLAYER",
    user: { id: OTHER_USER_ID, email: "player@example.com" },
  },
];

const playerMembers = [
  {
    userId: CURRENT_USER_ID,
    role: "PLAYER",
    user: { id: CURRENT_USER_ID, email: "player@example.com" },
  },
];

const sessions = [
  {
    id: "sess-1",
    sessionNumber: 1,
    date: "2026-06-01T00:00:00.000Z",
    summary: "The party arrived in town.",
    attendees: [
      {
        userId: CURRENT_USER_ID,
        user: { id: CURRENT_USER_ID, email: "owner@example.com" },
      },
    ],
  },
  {
    id: "sess-2",
    sessionNumber: 2,
    date: "2026-06-08T00:00:00.000Z",
    summary: null,
    attendees: [],
  },
];

function setupMocks({
  members = ownerMembers,
  sessionList = sessions,
  createSession = vi
    .fn()
    .mockResolvedValue({ data: { createSession: { id: "sess-3" } } }),
  updateSession = vi.fn().mockResolvedValue({ data: { updateSession: {} } }),
  deleteSession = vi.fn().mockResolvedValue({ data: { deleteSession: true } }),
  attachSessionAttendee = vi
    .fn()
    .mockResolvedValue({ data: { attachSessionAttendee: {} } }),
  detachSessionAttendee = vi
    .fn()
    .mockResolvedValue({ data: { detachSessionAttendee: {} } }),
  reexecuteSessions = vi.fn(),
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

    if (args.query === SessionsDocument) {
      return [
        { data: { sessions: sessionList }, fetching: false, stale: false },
        reexecuteSessions,
      ];
    }

    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === CreateSessionDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        createSession,
      ];
    }
    if (document === UpdateSessionDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        updateSession,
      ];
    }
    if (document === DeleteSessionDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        deleteSession,
      ];
    }
    if (document === AttachSessionAttendeeDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        attachSessionAttendee,
      ];
    }
    if (document === DetachSessionAttendeeDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        detachSessionAttendee,
      ];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return {
    createSession,
    updateSession,
    deleteSession,
    attachSessionAttendee,
    detachSessionAttendee,
    reexecuteSessions,
  };
}

function renderWindow() {
  render(
    <MemoryRouter>
      <SessionsWindow />
    </MemoryRouter>,
  );
}

describe("SessionsWindow", () => {
  it("lists sessions in reverse-chronological order with attendees and recap", () => {
    setupMocks();
    renderWindow();

    const badges = screen.getAllByText(/^#\d$/);
    expect(badges[0]).toHaveTextContent("#2");
    expect(badges[1]).toHaveTextContent("#1");
    expect(screen.getByText("The party arrived in town.")).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
  });

  it("shows create/edit/delete controls for an Owner", () => {
    setupMocks();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "+ Log session" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("hides write controls for a Player (read-only)", () => {
    setupMocks({ members: playerMembers });
    renderWindow();

    expect(screen.getByText("The party arrived in town.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ Log session" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no sessions", () => {
    setupMocks({ sessionList: [] });
    renderWindow();

    expect(screen.getByText("No sessions logged yet.")).toBeInTheDocument();
  });

  it("creates a session with selected attendees and refetches", async () => {
    const { createSession, attachSessionAttendee, reexecuteSessions } =
      setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ Log session" }));
    await user.type(screen.getByLabelText("Date"), "2026-07-01");
    await user.click(
      screen.getByRole("checkbox", { name: "owner@example.com" }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createSession).toHaveBeenCalledWith({
      input: { campaignId: "camp-1", date: "2026-07-01", summary: null },
    });
    expect(attachSessionAttendee).toHaveBeenCalledWith({
      sessionId: "sess-3",
      userId: CURRENT_USER_ID,
    });
    expect(reexecuteSessions).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("deletes a session after confirming and refetches", async () => {
    const { deleteSession, reexecuteSessions } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(deleteSession).toHaveBeenCalledWith({ id: "sess-2" });
    expect(reexecuteSessions).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });
});
