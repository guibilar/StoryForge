import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useMutation, useQuery } from "urql";

import { DesktopBoard } from "./DesktopBoard";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import {
  CampaignDocument,
  EntitiesDocument,
  EventsDocument,
  MeDocument,
  SessionsDocument,
} from "../gql/graphql";

// windowCatalog.ts always renders NpcsWindow, so replacing it with a harness
// that consumes useDesktopWindows() is the least invasive way to exercise
// DesktopBoard's dynamic-window wiring end-to-end without adding a
// test-only prop to DesktopBoard's public API.
vi.mock("./NpcsWindow", () => ({
  NpcsWindow: () => {
    const { openWindow, closeWindow } = useDesktopWindows();
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
      <DesktopBoard campaignId="camp-1" role="OWNER" />
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
    await user.click(screen.getByRole("button", { name: "Reset layout" }));

    expect(screen.getByText("Entity content")).toBeInTheDocument();
  });

  it("persists a dynamic window's position across reload (content isn't, and must be re-supplied by the caller on reopen)", async () => {
    const user = userEvent.setup();
    const { unmount } = renderBoard();

    await user.click(screen.getByRole("button", { name: "Open entity" }));
    unmount();

    // The render function/title aren't JSON-serializable, so a fresh mount
    // starts with no dynamic window registered — nothing to show yet.
    renderBoard();
    expect(screen.queryByText("Entity content")).not.toBeInTheDocument();

    const stored = JSON.parse(
      localStorage.getItem("storyforge:desktop:camp-1")!,
    );
    expect(stored["entity:1"]).toMatchObject({ x: 40, y: 40, hidden: false });
  });
});
