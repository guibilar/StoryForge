import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { StartMenu } from "./StartMenu";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { createDesktopWindowsStub } from "../lib/desktopWindowsStub";
import { EntitiesDocument } from "../gql/graphql";
import type { CampaignRole } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
});

vi.mock("../lib/DesktopWindowsContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/DesktopWindowsContext")>();
  return { ...actual, useDesktopWindows: vi.fn() };
});

const ENTITIES = [
  { id: "e1", name: "Wren Ashgrave", type: "PC", category: "CHARACTER" },
  { id: "e2", name: "House Marek", type: "FACTION", category: "ORGANIZATION" },
  { id: "e3", name: "Kestrel Hall", type: "PC", category: "LOCATION" },
];

const LAYOUT = {
  sessions: { x: 0, y: 0, width: 300, height: 200, hidden: false, z: 2 },
  timeline: { x: 0, y: 0, width: 300, height: 200, hidden: true, z: 1 },
  notes: { x: 0, y: 0, width: 300, height: 200, hidden: true, z: 1 },
  members: { x: 0, y: 0, width: 300, height: 200, hidden: true, z: 1 },
  maps: { x: 0, y: 0, width: 300, height: 200, hidden: true, z: 1 },
  relationships: { x: 0, y: 0, width: 300, height: 200, hidden: true, z: 1 },
};

vi.mocked(useMutation).mockImplementation((() => [
  { fetching: false, stale: false },
  vi.fn(),
]) as never);

function mockEntities(entities = ENTITIES) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === EntitiesDocument) {
      return [{ data: { entities }, fetching: false, stale: false }, vi.fn()];
    }
    return [{ data: undefined, fetching: false, stale: false }, vi.fn()];
  }) as never);
}

function renderMenu({
  role = "OWNER" as CampaignRole | undefined,
  onClose = vi.fn(),
  windows = {},
} = {}) {
  vi.mocked(useDesktopWindows).mockReturnValue(
    createDesktopWindowsStub({ layout: LAYOUT, ...windows }),
  );
  render(
    <MemoryRouter>
      <StartMenu
        campaignId="camp-1"
        campaignName="The Ashen Compact"
        role={role}
        userEmail="me@example.com"
        onClose={onClose}
      />
    </MemoryRouter>,
  );
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEntities();
});

describe("StartMenu", () => {
  it("focuses the search box when it opens", () => {
    renderMenu();

    expect(
      screen.getByRole("searchbox", { name: "Search windows and entities" }),
    ).toHaveFocus();
  });

  it("lists the windows the role can see", () => {
    renderMenu({ role: "PLAYER" });

    expect(
      screen.getByRole("button", { name: "Sessions" }),
    ).toBeInTheDocument();
    // Members is Storyteller-tier only, per the window catalog.
    expect(
      screen.queryByRole("button", { name: "Members" }),
    ).not.toBeInTheDocument();
  });

  it("opens a closed window and closes itself", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    const { onClose } = renderMenu({ windows: { toggle } });

    await user.click(screen.getByRole("button", { name: "Timeline" }));

    expect(toggle).toHaveBeenCalledWith("timeline");
    expect(onClose).toHaveBeenCalled();
  });

  // Clicking a window that is already up should raise it, not close it —
  // toggle would hide it, which is the opposite of what the menu offers.
  it("raises an already-open window instead of toggling it", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    const bringToFront = vi.fn();
    renderMenu({ windows: { toggle, bringToFront } });

    await user.click(screen.getByRole("button", { name: "Sessions" }));

    expect(bringToFront).toHaveBeenCalledWith("sessions");
    expect(toggle).not.toHaveBeenCalled();
  });

  it("restores a minimized window rather than raising it", async () => {
    const user = userEvent.setup();
    const restoreWindow = vi.fn();
    renderMenu({
      windows: {
        restoreWindow,
        layout: {
          ...LAYOUT,
          sessions: { ...LAYOUT.sessions, minimized: true },
        },
      },
    });

    await user.click(screen.getByRole("button", { name: "Sessions" }));

    expect(restoreWindow).toHaveBeenCalledWith("sessions");
  });

  it("groups entities by type and collapses a group", async () => {
    const user = userEvent.setup();
    renderMenu();

    expect(screen.getByRole("button", { name: /PC · 2/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Wren Ashgrave" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /PC · 2/ }));

    expect(
      screen.queryByRole("button", { name: "Wren Ashgrave" }),
    ).not.toBeInTheDocument();
  });

  it("filters windows and entities as you type", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.type(
      screen.getByRole("searchbox", { name: "Search windows and entities" }),
      "marek",
    );

    expect(
      screen.getByRole("button", { name: /House Marek/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Wren Ashgrave" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sessions" }),
    ).not.toBeInTheDocument();
  });

  it("shows recently opened entities above the full list", () => {
    renderMenu({ windows: { recentIds: ["e2"] } });

    const menu = screen.getByRole("dialog", { name: "Start menu" });
    expect(within(menu).getByText("Recent")).toBeInTheDocument();
    expect(
      within(menu).getAllByRole("button", { name: /House Marek/ }).length,
    ).toBeGreaterThan(1);
  });

  it("offers the create actions to writers only", () => {
    renderMenu({ role: "PLAYER" });

    expect(
      screen.queryByRole("button", { name: "New Entity" }),
    ).not.toBeInTheDocument();
  });

  it("saves the current arrangement as a named preset", async () => {
    const user = userEvent.setup();
    const savePreset = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValue("Session Prep");
    renderMenu({ windows: { savePreset } });

    await user.click(
      screen.getByRole("button", { name: "Save current layout…" }),
    );

    expect(savePreset).toHaveBeenCalledWith("Session Prep");
  });

  it("does not save a preset when the name prompt is cancelled", async () => {
    const user = userEvent.setup();
    const savePreset = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValue(null);
    renderMenu({ windows: { savePreset } });

    await user.click(
      screen.getByRole("button", { name: "Save current layout…" }),
    );

    expect(savePreset).not.toHaveBeenCalled();
  });

  it("applies a saved preset", async () => {
    const user = userEvent.setup();
    const applyPreset = vi.fn();
    renderMenu({
      windows: { applyPreset, presets: { "Session Prep": LAYOUT } },
    });

    await user.click(screen.getByRole("button", { name: "Session Prep" }));

    expect(applyPreset).toHaveBeenCalledWith("Session Prep");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderMenu();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("links back to the dashboard", () => {
    renderMenu();

    expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
