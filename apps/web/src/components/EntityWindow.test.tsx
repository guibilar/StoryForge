import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "urql";

import { EntityWindow } from "./EntityWindow";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import { EntitiesDocument, RelationshipsDocument } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useQuery: vi.fn() };
});

vi.mock("../lib/DesktopWindowsContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/DesktopWindowsContext")>();
  return { ...actual, useDesktopWindows: vi.fn() };
});

const ENTITY = {
  id: "e-1",
  name: "Carlos Mendoza",
  type: "Character",
  description: "A Tremere regent",
  visibility: "PUBLIC" as const,
};

const ENTITIES = [
  ENTITY,
  {
    id: "e-2",
    name: "Beatriz Moreau",
    type: "Character",
    description: null,
    visibility: "PUBLIC" as const,
  },
];

const RELATIONSHIPS = [
  {
    id: "rel-1",
    sourceEntityId: "e-1",
    targetEntityId: "e-2",
    type: "Sire",
    description: "Embraced her in 1998",
  },
];

function setupQueries({
  entities = ENTITIES,
  relationships = RELATIONSHIPS,
  entitiesFetching = false,
  relationshipsFetching = false,
  reexecuteEntities = vi.fn(),
  reexecuteRelationships = vi.fn(),
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === EntitiesDocument) {
      return [
        { data: { entities }, fetching: entitiesFetching, stale: false },
        reexecuteEntities,
      ];
    }
    if (args.query === RelationshipsDocument) {
      return [
        {
          data: { relationships },
          fetching: relationshipsFetching,
          stale: false,
        },
        reexecuteRelationships,
      ];
    }
    throw new Error("Unexpected query in test");
  }) as never);

  return { reexecuteEntities, reexecuteRelationships };
}

function setupDesktopWindows() {
  const openWindow = vi.fn();
  vi.mocked(useDesktopWindows).mockReturnValue({
    layout: {},
    bringToFront: vi.fn(),
    toggle: vi.fn(),
    startDrag: vi.fn(),
    startResize: vi.fn(),
    reset: vi.fn(),
    dynamicWindows: {},
    openWindow,
    closeWindow: vi.fn(),
    recentIds: [],
    presets: {},
    savePreset: vi.fn(),
    applyPreset: vi.fn(),
    hydrateFromServer: vi.fn(),
  });
  return { openWindow };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EntityWindow", () => {
  it("shows the entity's name, type, and visibility on the Overview tab by default", () => {
    setupQueries();
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    expect(screen.getByText("Carlos Mendoza")).toBeInTheDocument();
    expect(screen.getByText("Character")).toBeInTheDocument();
    expect(screen.getByText("PUBLIC")).toBeInTheDocument();
    expect(screen.getByText("A Tremere regent")).toBeInTheDocument();
  });

  it("shows a placeholder when there's no description", () => {
    setupQueries();
    setupDesktopWindows();
    render(
      <EntityWindow
        entity={{ ...ENTITY, description: null }}
        campaignId="camp-1"
      />,
    );

    expect(screen.getByText("No description yet.")).toBeInTheDocument();
  });

  it("shows the Notes tab as a stub", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Notes" }));

    expect(screen.getByText("Notes — coming soon.")).toBeInTheDocument();
  });

  it("lists relationships with the counterpart's name and relationship type", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Relationships" }));

    expect(
      screen.getByRole("button", { name: "Beatriz Moreau" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sire")).toBeInTheDocument();
    expect(screen.getByText("Embraced her in 1998")).toBeInTheDocument();
  });

  it("shows an empty state when there are no relationships", async () => {
    const user = userEvent.setup();
    setupQueries({ relationships: [] });
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Relationships" }));

    expect(
      screen.getByText("No recorded relationships yet."),
    ).toBeInTheDocument();
  });

  it("opens the counterpart entity's window when clicked", async () => {
    const user = userEvent.setup();
    setupQueries();
    const { openWindow } = setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Relationships" }));
    await user.click(screen.getByRole("button", { name: "Beatriz Moreau" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "entity:e-2", title: "Beatriz Moreau" }),
    );
  });

  it("reports loading and a network-only refresh to the window chrome while on the Relationships tab", async () => {
    const user = userEvent.setup();
    const { reexecuteEntities, reexecuteRelationships } = setupQueries();
    setupDesktopWindows();
    const chromeApi = { setLoading: vi.fn(), setOnRefresh: vi.fn() };
    render(
      <WindowChromeContext.Provider value={chromeApi}>
        <EntityWindow entity={ENTITY} campaignId="camp-1" />
      </WindowChromeContext.Provider>,
    );

    await user.click(screen.getByRole("tab", { name: "Relationships" }));

    expect(chromeApi.setLoading).toHaveBeenLastCalledWith(false);
    const registered = chromeApi.setOnRefresh.mock.calls.at(-1)?.[0]() as
      (() => void) | undefined;
    registered?.();

    expect(reexecuteEntities).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
    expect(reexecuteRelationships).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("resets the window chrome's loading state when navigating away from Relationships", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows();
    const chromeApi = { setLoading: vi.fn(), setOnRefresh: vi.fn() };
    render(
      <WindowChromeContext.Provider value={chromeApi}>
        <EntityWindow entity={ENTITY} campaignId="camp-1" />
      </WindowChromeContext.Provider>,
    );

    await user.click(screen.getByRole("tab", { name: "Relationships" }));
    await user.click(screen.getByRole("tab", { name: "Overview" }));

    expect(chromeApi.setLoading).toHaveBeenLastCalledWith(false);
  });
});
