import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

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
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
});

vi.mocked(useMutation).mockImplementation((() => [
  { fetching: false, stale: false },
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

  it("renders the crumb with campaign name and role, and the desktop board above the breakpoint", () => {
    mockMatchMedia(false);
    setupMocks();
    renderPage();

    expect(screen.getByText("The Sabbat War · OWNER")).toBeInTheDocument();
    expect(screen.getByTestId("desktop-board")).toBeInTheDocument();
  });

  it("renders the entity sidebar alongside the board above the breakpoint", () => {
    mockMatchMedia(false);
    setupMocks();
    renderPage();

    const nav = screen.getByRole("navigation", {
      name: "Campaign navigation",
    });
    expect(nav).toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: "Timeline" }),
    ).toBeInTheDocument();
  });

  it("does not render the entity sidebar below the breakpoint", () => {
    mockMatchMedia(true);
    setupMocks();
    renderPage();

    expect(
      screen.queryByRole("navigation", { name: "Campaign navigation" }),
    ).not.toBeInTheDocument();
  });

  it("renders the single-panel mobile fallback below the breakpoint", () => {
    mockMatchMedia(true);
    setupMocks();
    renderPage();

    expect(screen.queryByTestId("desktop-board")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Members" }),
    ).toBeInTheDocument();
  });
});
