import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { SessionsWindow } from "./SessionsWindow";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  CampaignDocument,
  DeleteSessionDocument,
  MeDocument,
  SessionsDocument,
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
  deleteSession = vi.fn().mockResolvedValue({ data: { deleteSession: true } }),
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
    if (document === DeleteSessionDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        deleteSession,
      ];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { deleteSession, reexecuteSessions };
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
        <SessionsWindow />
      </MemoryRouter>
    </WindowChromeContext.Provider>,
  );
  return chromeApi;
}

describe("SessionsWindow", () => {
  it("lists sessions in reverse-chronological order with attendees and recap", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    const badges = screen.getAllByText(/^#\d$/);
    expect(badges[0]).toHaveTextContent("#2");
    expect(badges[1]).toHaveTextContent("#1");
    expect(screen.getByText("The party arrived in town.")).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
  });

  it("shows create/edit/delete controls for an Owner", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "+ Log session" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("hides write controls for a Player (read-only)", () => {
    setupMocks({ members: playerMembers });
    setupDesktopWindows();
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
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByText("No sessions logged yet.")).toBeInTheDocument();
  });

  it("opens a create window when + Log session is clicked", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ Log session" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-form:new", title: "Log Session" }),
    );
  });

  it("opens an edit window when Edit is clicked", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "session-form:sess-2",
        title: "Edit: Session #2",
      }),
    );
  });

  it("deletes a session after confirming and refetches", async () => {
    const { deleteSession, reexecuteSessions } = setupMocks();
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(deleteSession).toHaveBeenCalledWith({ id: "sess-2" });
    expect(reexecuteSessions).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("reports its loading state and a network-only refresh to the window chrome", () => {
    const { reexecuteSessions } = setupMocks();
    setupDesktopWindows();
    const chromeApi = renderWindow();

    expect(chromeApi.setLoading).toHaveBeenCalledWith(false);
    const registered = chromeApi.setOnRefresh.mock.calls.at(-1)?.[0]() as
      (() => void) | undefined;
    registered?.();

    expect(reexecuteSessions).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });
});
