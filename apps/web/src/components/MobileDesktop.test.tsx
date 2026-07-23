import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useMutation, useQuery } from "urql";
import { vi } from "vitest";

import { MobileDesktop } from "./MobileDesktop";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import {
  CampaignDocument,
  EntitiesDocument,
  EventsDocument,
  MeDocument,
  SessionsDocument,
} from "../gql/graphql";
import { createDesktopWindowsStub } from "../lib/desktopWindowsStub";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
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

vi.mocked(useDesktopWindows).mockReturnValue(createDesktopWindowsStub());

vi.mocked(useMutation).mockImplementation((() => [
  { fetching: false, stale: false },
  vi.fn(),
]) as never);

vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
  if (args.query === MeDocument) {
    return [
      {
        data: { me: { id: "user-1", email: "me@example.com" } },
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
                userId: "user-1",
                role: "OWNER",
                user: { id: "user-1", email: "me@example.com" },
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

function renderMobileDesktop() {
  render(
    <MemoryRouter>
      <MobileDesktop />
    </MemoryRouter>,
  );
}

const LAYOUT = {
  sessions: { x: 0, y: 0, width: 300, height: 200, hidden: false, z: 2 },
  timeline: { x: 0, y: 0, width: 300, height: 200, hidden: true, z: 1 },
};

describe("MobileDesktop", () => {
  it("shows the top window of the shared layout as its one panel", () => {
    vi.mocked(useDesktopWindows).mockReturnValue(
      createDesktopWindowsStub({ layout: LAYOUT }),
    );
    renderMobileDesktop();

    expect(
      screen.getByRole("heading", { name: "Sessions" }),
    ).toBeInTheDocument();
  });

  // The phone shell reads the same window state as the desktop one, so
  // raising a different window (from the taskbar or the start menu) is what
  // switches panels — there is no separate mobile selection to keep in sync.
  it("follows the top of the z-stack when another window is raised", () => {
    vi.mocked(useDesktopWindows).mockReturnValue(
      createDesktopWindowsStub({
        layout: {
          ...LAYOUT,
          timeline: { ...LAYOUT.timeline, hidden: false, z: 9 },
        },
      }),
    );
    renderMobileDesktop();

    expect(
      screen.getByRole("heading", { name: "Timeline" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No events yet.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sessions" }),
    ).not.toBeInTheDocument();
  });

  it("closes the panel's window through the shared state", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    vi.mocked(useDesktopWindows).mockReturnValue(
      createDesktopWindowsStub({ layout: LAYOUT, toggle }),
    );
    renderMobileDesktop();

    await user.click(screen.getByRole("button", { name: "Close Sessions" }));

    expect(toggle).toHaveBeenCalledWith("sessions");
  });

  it("prompts for the start menu when nothing is open", () => {
    vi.mocked(useDesktopWindows).mockReturnValue(
      createDesktopWindowsStub({
        layout: { sessions: { ...LAYOUT.sessions, hidden: true } },
      }),
    );
    renderMobileDesktop();

    expect(screen.getByText(/Nothing open/)).toBeInTheDocument();
  });
});
