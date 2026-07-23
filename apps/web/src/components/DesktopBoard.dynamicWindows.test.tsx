import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useMutation, useQuery } from "urql";

import { DesktopBoard } from "./DesktopBoard";
import {
  DesktopWindowsContext,
  useDesktopWindows,
} from "../lib/DesktopWindowsContext";
import { useDesktopWindowsController } from "../hooks/useDesktopWindowsController";
import {
  CampaignDocument,
  EntitiesDocument,
  EntityDocument,
  EventsDocument,
  MeDocument,
  SessionsDocument,
} from "../gql/graphql";

// DesktopBoard now reads window state from context (KAN-96 lifted ownership
// up to CampaignDesktopPage so the taskbar and start menu can share it)
// rather than owning it itself — this harness stands in for that owner in
// isolation.
function Harness({ campaignId }: { campaignId: string }) {
  const desktopWindows = useDesktopWindowsController(campaignId);
  return (
    <DesktopWindowsContext.Provider value={desktopWindows}>
      <DesktopBoard campaignId="camp-1" role="OWNER" />
    </DesktopWindowsContext.Provider>
  );
}

// windowCatalog.ts always renders SessionsWindow regardless of role, so
// replacing it with a harness that consumes useDesktopWindows() is the
// least invasive way to exercise DesktopBoard's dynamic-window wiring
// end-to-end without adding a test-only prop to DesktopBoard's public API.
vi.mock("./SessionsWindow", () => ({
  SessionsWindow: () => {
    const { openWindow, closeWindow, reset } = useDesktopWindows();
    return (
      <div>
        <button
          type="button"
          onClick={() =>
            openWindow({
              id: "entity:1",
              title: "Test Entity",
              render: () => <p>Entity content</p>,
              x: 40,
              y: 40,
              width: 300,
              height: 200,
            })
          }
        >
          Open entity
        </button>
        <button type="button" onClick={reset}>
          Reset layout from harness
        </button>
        <button type="button" onClick={() => closeWindow("entity:1")}>
          Close entity from harness
        </button>
      </div>
    );
  },
}));

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

const CURRENT_USER_ID = "user-1";

vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
  if (args.query === MeDocument) {
    return [
      {
        data: { me: { id: CURRENT_USER_ID, email: "owner@example.com" } },
        fetching: false,
        stale: false,
      },
      vi.fn(),
    ];
  }

  if (args.query === CampaignDocument) {
    return [
      {
        data: {
          campaign: {
            id: "camp-1",
            name: "Campaign",
            members: [
              {
                userId: CURRENT_USER_ID,
                role: "OWNER",
                user: { id: CURRENT_USER_ID, email: "owner@example.com" },
              },
            ],
          },
        },
        fetching: false,
        stale: false,
      },
      vi.fn(),
    ];
  }

  // A window restored after a reload fetches its own entity by id.
  if (args.query === EntityDocument) {
    return [
      {
        data: {
          entity: {
            id: "1",
            name: "Test Entity",
            type: "Character",
            category: "CHARACTER",
            description: "Restored from its window id",
            image: null,
            color: null,
            visibility: "PUBLIC",
          },
        },
        fetching: false,
        stale: false,
      },
      vi.fn(),
    ];
  }

  if (args.query === EntitiesDocument) {
    return [{ data: { entities: [] }, fetching: false, stale: false }, vi.fn()];
  }

  if (args.query === EventsDocument) {
    return [{ data: { events: [] }, fetching: false, stale: false }, vi.fn()];
  }

  if (args.query === SessionsDocument) {
    return [{ data: { sessions: [] }, fetching: false, stale: false }, vi.fn()];
  }

  throw new Error("Unexpected query in test");
}) as never);

vi.mocked(useMutation).mockImplementation((() => [
  { fetching: false, stale: false },
  vi.fn(),
]) as never);

beforeEach(() => {
  localStorage.clear();
});

function renderBoard() {
  return render(
    <MemoryRouter>
      <Harness campaignId="camp-1" />
    </MemoryRouter>,
  );
}

describe("DesktopBoard dynamic windows", () => {
  it("opens a window for a runtime id via useDesktopWindows and closes it", async () => {
    const user = userEvent.setup();
    renderBoard();

    expect(screen.queryByText("Entity content")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open entity" }));
    expect(screen.getByText("Entity content")).toBeInTheDocument();
    expect(
      screen.getByText("Test Entity", { selector: "span" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close Test Entity" }));
    expect(screen.queryByText("Entity content")).not.toBeInTheDocument();
  });

  it("opening the same id twice focuses it instead of duplicating it", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(screen.getByRole("button", { name: "Open entity" }));
    await user.click(screen.getByRole("button", { name: "Open entity" }));

    expect(screen.getAllByText("Entity content")).toHaveLength(1);
  });

  it("closing via the context removes the window same as the close button", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(screen.getByRole("button", { name: "Open entity" }));
    await user.click(
      screen.getByRole("button", { name: "Close entity from harness" }),
    );

    expect(screen.queryByText("Entity content")).not.toBeInTheDocument();
  });

  it("reset layout leaves a dynamically-opened window open", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(screen.getByRole("button", { name: "Open entity" }));
    await user.click(
      screen.getByRole("button", { name: "Reset layout from harness" }),
    );

    expect(screen.getByText("Entity content")).toBeInTheDocument();
  });

  it("restores a dynamic window, and its position, across a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = renderBoard();

    await user.click(screen.getByRole("button", { name: "Open entity" }));
    unmount();

    // The render function isn't serializable, so it's rebuilt from the
    // window id (see lib/dynamicWindowRegistry) rather than restored —
    // which is why the content is the real EntityWindow fetched by id, not
    // the harness's stand-in "Entity content".
    renderBoard();

    expect(
      await screen.findByText("Restored from its window id"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Test Entity" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Entity content")).not.toBeInTheDocument();

    const stored = JSON.parse(
      localStorage.getItem("storyforge:desktop:camp-1")!,
    );
    expect(stored["entity:1"]).toMatchObject({ x: 40, y: 40, hidden: false });
  });
});
