import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery, useSubscription } from "urql";

import { CampaignDesktopPage } from "./CampaignDesktopPage";
import {
  CampaignDocument,
  EntitiesDocument,
  MeDocument,
  MyWorkspaceStateDocument,
  NotesDocument,
  SessionsDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useSubscription: vi.fn(),
  };
});

vi.mocked(useMutation).mockImplementation((() => [
  { fetching: false, stale: false },
  vi.fn(),
]) as never);

// ForceOpenEntityListener (KAN-133 side A) is mounted here unconditionally
// (mobile and desktop alike) — no test in this file exercises a delivered
// payload, so the subscription always resolves with no data.
vi.mocked(useSubscription).mockImplementation((() => [
  { data: undefined, fetching: false, stale: false },
  vi.fn(),
]) as never);

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ id: "camp-1" }) };
});

const CURRENT_USER_ID = "user-1";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function setupMocks({
  fetching = false,
  campaign = {
    id: "camp-1",
    name: "The Sabbat War",
    members: [
      {
        userId: CURRENT_USER_ID,
        role: "OWNER",
        user: { id: CURRENT_USER_ID, email: "me@example.com" },
      },
    ],
  } as {
    id: string;
    name: string;
    members: {
      userId: string;
      role: string;
      user: { id: string; email: string };
    }[];
  } | null,
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === MeDocument) {
      return [
        {
          data: { me: { id: CURRENT_USER_ID, email: "me@example.com" } },
          fetching: false,
          stale: false,
        },
        vi.fn(),
      ];
    }

    if (args.query === CampaignDocument) {
      return [{ data: { campaign }, fetching, stale: false }, vi.fn()];
    }

    if (args.query === EntitiesDocument) {
      return [
        { data: { entities: [] }, fetching: false, stale: false },
        vi.fn(),
      ];
    }

    if (args.query === SessionsDocument) {
      return [
        { data: { sessions: [] }, fetching: false, stale: false },
        vi.fn(),
      ];
    }

    if (args.query === NotesDocument) {
      return [
        { data: { noteRoots: [] }, fetching: false, stale: false },
        vi.fn(),
      ];
    }

    if (args.query === MyWorkspaceStateDocument) {
      return [
        { data: { myWorkspaceState: null }, fetching: false, stale: false },
        vi.fn(),
      ];
    }

    throw new Error("Unexpected query in test");
  }) as never);
}

function renderPage() {
  render(
    <MemoryRouter>
      <CampaignDesktopPage />
    </MemoryRouter>,
  );
}

describe("CampaignDesktopPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows a loading state while the campaign query is in flight", () => {
    mockMatchMedia(false);
    setupMocks({ fetching: true });
    renderPage();

    expect(screen.getByText("Loading campaign…")).toBeInTheDocument();
  });

  it("shows a not-found message when the campaign is null", () => {
    mockMatchMedia(false);
    setupMocks({ campaign: null });
    renderPage();

    expect(screen.getByText("Campaign not found.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to dashboard" }),
    ).toBeInTheDocument();
  });

  it("renders the desktop board and taskbar above the breakpoint", () => {
    mockMatchMedia(false);
    setupMocks();
    renderPage();

    expect(screen.getByTestId("desktop-board")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Open windows" }),
    ).toBeInTheDocument();
    // Role moved from the old page header to the taskbar tray. Queried by
    // title, since MembersWindow's role picker also has an "Owner" option.
    expect(screen.getByTitle("Your role in this campaign")).toHaveTextContent(
      "Owner",
    );
  });

  it("puts every open window on the taskbar", () => {
    mockMatchMedia(false);
    setupMocks();
    renderPage();

    const tasks = screen.getByRole("group", { name: "Open windows" });
    // DEFAULT_LAYOUT ships Members and Sessions open, the rest closed.
    expect(
      within(tasks).getByRole("button", { name: /Members/ }),
    ).toBeInTheDocument();
    expect(
      within(tasks).getByRole("button", { name: /Sessions/ }),
    ).toBeInTheDocument();
    expect(
      within(tasks).queryByRole("button", { name: /Timeline/ }),
    ).not.toBeInTheDocument();
  });

  it("opens the start menu from the taskbar, with the campaign name in it", async () => {
    const user = userEvent.setup();
    mockMatchMedia(false);
    setupMocks();
    renderPage();

    await user.click(screen.getByRole("button", { name: /StoryForge/ }));

    const menu = screen.getByRole("dialog", { name: "Start menu" });
    expect(
      within(menu).getByRole("heading", { name: "The Sabbat War" }),
    ).toBeInTheDocument();
  });

  it("minimizes the focused window from its taskbar button and restores it", async () => {
    const user = userEvent.setup();
    mockMatchMedia(false);
    setupMocks();
    renderPage();

    const tasks = screen.getByRole("group", { name: "Open windows" });
    // Members ships on top of Sessions in DEFAULT_LAYOUT, so it is the
    // focused window and its button rolls it down rather than raising it.
    const membersTask = within(tasks).getByRole("button", { name: /Members/ });
    expect(membersTask).toHaveAttribute("aria-pressed", "true");

    await user.click(membersTask);
    expect(
      screen.queryByRole("button", { name: "Close Members" }),
    ).not.toBeInTheDocument();
    expect(membersTask).toHaveAttribute("aria-pressed", "false");

    await user.click(membersTask);
    expect(
      screen.getByRole("button", { name: "Close Members" }),
    ).toBeInTheDocument();
  });

  it("renders the mobile shell below the breakpoint, sharing the same taskbar", () => {
    mockMatchMedia(true);
    setupMocks();
    renderPage();

    expect(screen.queryByTestId("desktop-board")).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Open windows" }),
    ).toBeInTheDocument();
    // No desk behind the panel on a phone, so no show-desktop strip.
    expect(
      screen.queryByRole("button", { name: "Show desktop" }),
    ).not.toBeInTheDocument();
  });

  it("shows the top window as the single mobile panel", () => {
    mockMatchMedia(true);
    setupMocks();
    renderPage();

    // Members is the top of the z-stack in DEFAULT_LAYOUT, so that is the
    // panel a phone shows; the taskbar switches to the others.
    expect(
      screen.getByRole("heading", { name: "Members" }),
    ).toBeInTheDocument();
  });
});
