import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { EntityWindow } from "./EntityWindow";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  CampaignDocument,
  EntitiesDocument,
  EntityNotesDocument,
  ForceOpenEntityWindowDocument,
  MeDocument,
  RelationshipsDocument,
  UpdateEntityDocument,
  UploadEntityImageDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
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

// A writer (Storyteller) alongside a PLAYER — what the force-open
// broadcast-target picker's dropdown should offer (KAN-133).
const ownerWithPlayersMembers = [
  ...ownerMembers,
  {
    userId: "user-2",
    role: "PLAYER",
    user: { id: "user-2", email: "player-two@example.com" },
  },
];

const ENTITY = {
  id: "e-1",
  name: "Carlos Mendoza",
  type: "Character",
  category: "CHARACTER" as const,
  description: "A Tremere regent",
  image: null as string | null,
  color: null as string | null,
  visibility: "PUBLIC" as const,
};

const LOCATION_ENTITY = {
  id: "e-3",
  name: "The Rack",
  type: "District",
  category: "LOCATION" as const,
  description: null,
  image: null as string | null,
  color: null as string | null,
  visibility: "PUBLIC" as const,
};

const ENTITIES = [
  ENTITY,
  {
    id: "e-2",
    name: "Beatriz Moreau",
    type: "Character",
    category: "CHARACTER" as const,
    description: null,
    image: null,
    color: null,
    visibility: "PUBLIC" as const,
  },
];

interface RelationshipMock {
  id: string;
  // Null when the API redacts a concealed endpoint (KAN-134) for this viewer.
  sourceEntityId: string | null;
  targetEntityId: string | null;
  type: string;
  description?: string | null;
}

const RELATIONSHIPS: RelationshipMock[] = [
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
  members = ownerMembers,
  entitiesFetching = false,
  relationshipsFetching = false,
  reexecuteEntities = vi.fn(),
  reexecuteRelationships = vi.fn(),
  uploadEntityImage = vi
    .fn()
    .mockResolvedValue({ data: { uploadEntityImage: { id: "e-1" } } }),
  uploadEntityImageFetching = false,
  uploadEntityImageError = undefined as
    { graphQLErrors: unknown[] } | undefined,
  forceOpenEntityWindow = vi
    .fn()
    .mockResolvedValue({ data: { forceOpenEntityWindow: true } }),
  forceOpenEntityWindowFetching = false,
  forceOpenEntityWindowError = undefined as
    { graphQLErrors: unknown[] } | undefined,
  updateEntity = vi.fn().mockImplementation(({ input }) =>
    Promise.resolve({
      data: { updateEntity: { id: input.id, color: input.color ?? null } },
    }),
  ),
  updateEntityFetching = false,
  backlinks = [] as { id: string; title: string; content: string }[],
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
    if (args.query === EntityNotesDocument) {
      return [
        {
          data: { entity: { id: ENTITY.id, backlinks } },
          fetching: false,
          stale: false,
        },
        vi.fn(),
      ];
    }
    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === UploadEntityImageDocument) {
      return [
        {
          fetching: uploadEntityImageFetching,
          error: uploadEntityImageError,
          stale: false,
        },
        uploadEntityImage,
      ];
    }
    if (document === ForceOpenEntityWindowDocument) {
      return [
        {
          fetching: forceOpenEntityWindowFetching,
          error: forceOpenEntityWindowError,
          stale: false,
        },
        forceOpenEntityWindow,
      ];
    }
    if (document === UpdateEntityDocument) {
      return [
        { fetching: updateEntityFetching, error: undefined, stale: false },
        updateEntity,
      ];
    }
    throw new Error("Unexpected mutation in test");
  }) as never);

  return {
    reexecuteEntities,
    reexecuteRelationships,
    uploadEntityImage,
    forceOpenEntityWindow,
    updateEntity,
  };
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

  it("renders the entity's picture, resolved against the API origin", () => {
    setupQueries();
    setupDesktopWindows();
    render(
      <EntityWindow
        entity={{ ...ENTITY, image: "/uploads/e-1/portrait.png" }}
        campaignId="camp-1"
      />,
    );

    const img = screen.getByRole("img", { name: "Carlos Mendoza portrait" });
    expect(img).toHaveAttribute(
      "src",
      "http://localhost:4000/uploads/e-1/portrait.png",
    );
  });

  it("shows Upload Picture (no image) for a writer when the entity has no picture", () => {
    setupQueries();
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    expect(
      screen.getByRole("button", { name: "Upload Picture" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("hides the upload control for a non-writer", () => {
    setupQueries({ members: playerMembers });
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    expect(
      screen.queryByRole("button", { name: "Upload Picture" }),
    ).not.toBeInTheDocument();
  });

  it("uploads the selected file and shows the returned image immediately", async () => {
    const { uploadEntityImage } = setupQueries({
      uploadEntityImage: vi.fn().mockResolvedValue({
        data: {
          uploadEntityImage: { id: "e-1", image: "/uploads/e-1/new.png" },
        },
      }),
    });
    setupDesktopWindows();
    const user = userEvent.setup();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    const file = new File(["fake-bytes"], "portrait.png", {
      type: "image/png",
    });
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();

    await user.upload(input as HTMLInputElement, file);

    expect(uploadEntityImage).toHaveBeenCalledWith({
      entityId: "e-1",
      file,
    });
    expect(
      screen.getByRole("img", { name: "Carlos Mendoza portrait" }),
    ).toHaveAttribute("src", "http://localhost:4000/uploads/e-1/new.png");
    expect(
      screen.getByRole("button", { name: "Replace Picture" }),
    ).toBeInTheDocument();
  });

  it("rejects an oversized file client-side without calling uploadEntityImage", async () => {
    const { uploadEntityImage } = setupQueries();
    setupDesktopWindows();
    const user = userEvent.setup();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    const oversizedFile = new File(
      [new Uint8Array(6 * 1024 * 1024)],
      "huge-portrait.png",
      { type: "image/png" },
    );
    const input = document.querySelector('input[type="file"]');

    await user.upload(input as HTMLInputElement, oversizedFile);

    expect(
      screen.getByText("File size exceeds the maximum limit of 5MB."),
    ).toBeInTheDocument();
    expect(uploadEntityImage).not.toHaveBeenCalled();
  });

  it("surfaces an error when the upload fails, instead of failing silently", async () => {
    setupQueries({
      uploadEntityImage: vi.fn().mockResolvedValue({ data: undefined }),
      uploadEntityImageError: {
        graphQLErrors: [{ message: "You are not allowed to do that." }],
      } as never,
    });
    setupDesktopWindows();
    const user = userEvent.setup();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    const file = new File(["fake-bytes"], "portrait.png", {
      type: "image/png",
    });
    const input = document.querySelector('input[type="file"]');

    await user.upload(input as HTMLInputElement, file);

    expect(
      screen.getByText("You are not allowed to do that."),
    ).toBeInTheDocument();
  });

  it("shows Set Map Color for a writer on a map-linkable entity", () => {
    setupQueries();
    setupDesktopWindows();
    render(<EntityWindow entity={LOCATION_ENTITY} campaignId="camp-1" />);

    expect(
      screen.getByRole("button", { name: "Set Map Color" }),
    ).toBeInTheDocument();
  });

  it("hides the map color control for a non-map-linkable entity", () => {
    setupQueries();
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    expect(
      screen.queryByRole("button", { name: "Set Map Color" }),
    ).not.toBeInTheDocument();
  });

  it("hides the map color control for a non-writer", () => {
    setupQueries({ members: playerMembers });
    setupDesktopWindows();
    render(<EntityWindow entity={LOCATION_ENTITY} campaignId="camp-1" />);

    expect(
      screen.queryByRole("button", { name: "Set Map Color" }),
    ).not.toBeInTheDocument();
  });

  it("sets the map color and shows a swatch and Reset button", async () => {
    const { updateEntity } = setupQueries();
    setupDesktopWindows();
    render(<EntityWindow entity={LOCATION_ENTITY} campaignId="camp-1" />);

    const input = document.querySelector('input[type="color"]');
    expect(input).toBeTruthy();
    fireEvent.change(input as HTMLInputElement, {
      target: { value: "#4287f5" },
    });

    expect(updateEntity).toHaveBeenCalledWith({
      input: { id: "e-3", color: "#4287f5" },
    });
    expect(
      await screen.findByRole("button", { name: "Change Map Color" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("resets the map color", async () => {
    const { updateEntity } = setupQueries();
    setupDesktopWindows();
    const user = userEvent.setup();
    render(
      <EntityWindow
        entity={{ ...LOCATION_ENTITY, color: "#4287f5" }}
        campaignId="camp-1"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(updateEntity).toHaveBeenCalledWith({
      input: { id: "e-3", color: null },
    });
    expect(
      screen.getByRole("button", { name: "Set Map Color" }),
    ).toBeInTheDocument();
  });

  it("resyncs local image/color state when the same window is reopened with fresher entity data", () => {
    setupQueries();
    setupDesktopWindows();
    const { rerender } = render(
      <EntityWindow
        entity={{ ...LOCATION_ENTITY, image: null, color: null }}
        campaignId="camp-1"
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set Map Color" }),
    ).toBeInTheDocument();

    rerender(
      <EntityWindow
        entity={{
          ...LOCATION_ENTITY,
          image: "/uploads/e-3/portrait.png",
          color: "#4287f5",
        }}
        campaignId="camp-1"
      />,
    );

    expect(
      screen.getByRole("img", { name: "The Rack portrait" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change Map Color" }),
    ).toBeInTheDocument();
  });

  it("tells you how to relate a note when nothing links to the entity yet", async () => {
    const user = userEvent.setup();
    setupQueries();
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Notes" }));

    expect(
      screen.getByText(`No notes mention ${ENTITY.name} yet.`, {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  it("lists the notes that [[link]] to this entity, with the link syntax stripped from the preview", async () => {
    const user = userEvent.setup();
    setupQueries({
      backlinks: [
        {
          id: "note-1",
          title: "Ambush at the docks",
          content: "The [[Carlos Mendoza|entity:e-1]] crew hit us.",
        },
      ],
    });
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Notes" }));

    expect(screen.getByText("Ambush at the docks")).toBeInTheDocument();
    expect(
      screen.getByText("The Carlos Mendoza crew hit us."),
    ).toBeInTheDocument();
  });

  it("lets a player add a note about the entity, defaulting it to private", async () => {
    const user = userEvent.setup();
    setupQueries({
      members: [
        {
          userId: CURRENT_USER_ID,
          role: "PLAYER",
          user: { id: CURRENT_USER_ID, email: "player@example.com" },
        },
      ],
    });
    const { openWindow } = setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Notes" }));
    await user.click(screen.getByRole("button", { name: "New note" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `note-form:new:entity-${ENTITY.id}`,
        title: `New note · ${ENTITY.name}`,
      }),
    );
  });

  it("hides the note create action from an Observer", async () => {
    const user = userEvent.setup();
    setupQueries({
      members: [
        {
          userId: CURRENT_USER_ID,
          role: "OBSERVER",
          user: { id: CURRENT_USER_ID, email: "observer@example.com" },
        },
      ],
    });
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Notes" }));

    expect(
      screen.queryByRole("button", { name: "New note" }),
    ).not.toBeInTheDocument();
  });

  it("does not render a relationship whose counterpart the viewer cannot see", async () => {
    const user = userEvent.setup();
    setupQueries({
      relationships: [
        {
          id: "rel-hidden",
          sourceEntityId: ENTITY.id,
          // Not present in the (visibility-filtered) entities list.
          targetEntityId: "entity-hidden",
          type: "Sired by",
          description: "A spoiler the player must not read.",
        },
      ],
    });
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Relationships" }));

    expect(
      screen.queryByText("A spoiler the player must not read."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Sired by")).not.toBeInTheDocument();
    expect(screen.queryByText("Unknown entity")).not.toBeInTheDocument();
    expect(
      screen.getByText("No recorded relationships yet."),
    ).toBeInTheDocument();
  });

  it("renders a concealed counterpart as Unknown instead of dropping the row", async () => {
    const user = userEvent.setup();
    setupQueries({
      relationships: [
        {
          id: "rel-concealed",
          sourceEntityId: ENTITY.id,
          // Redacted by the API for a non-Storyteller viewer (KAN-134) —
          // must still render, not vanish like the "hidden entity" case above.
          targetEntityId: null,
          type: "Blackmailed by",
          description: "Someone has leverage over Carlos.",
        },
      ],
    });
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Relationships" }));

    expect(screen.getByRole("button", { name: "Unknown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unknown" })).toBeDisabled();
    expect(screen.getByText("Blackmailed by")).toBeInTheDocument();
    expect(
      screen.getByText("Someone has leverage over Carlos."),
    ).toBeInTheDocument();
  });

  it("resolves the real counterpart when this entity itself is the concealed side", async () => {
    // The redacted field no longer equals entity.id once it's null, so the
    // naive "sourceEntityId === entity.id ? target : source" ternary would
    // misattribute the counterpart here — this pins the fallback behavior.
    const user = userEvent.setup();
    setupQueries({
      relationships: [
        {
          id: "rel-self-concealed",
          sourceEntityId: null,
          targetEntityId: "e-2",
          type: "Blackmails",
          description: null,
        },
      ],
    });
    setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Relationships" }));

    expect(
      screen.getByRole("button", { name: "Beatriz Moreau" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
  });

  it("opens a note window when a linked note is clicked", async () => {
    const user = userEvent.setup();
    setupQueries({
      backlinks: [
        { id: "note-1", title: "Ambush at the docks", content: "shots" },
      ],
    });
    const { openWindow } = setupDesktopWindows();
    render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

    await user.click(screen.getByRole("tab", { name: "Notes" }));
    await user.click(
      screen.getByRole("button", { name: /Ambush at the docks/ }),
    );

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "note:note-1",
        title: "Ambush at the docks",
      }),
    );
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

  describe("KAN-133 force-open entity window", () => {
    it("hides the 'Open for player(s)…' action for a Player", () => {
      setupQueries({ members: playerMembers });
      setupDesktopWindows();
      render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

      expect(
        screen.queryByRole("button", { name: "Open for player(s)…" }),
      ).not.toBeInTheDocument();
    });

    it("shows the 'Open for player(s)…' action for a Storyteller-tier writer", () => {
      setupQueries({ members: ownerWithPlayersMembers });
      setupDesktopWindows();
      render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

      expect(
        screen.getByRole("button", { name: "Open for player(s)…" }),
      ).toBeInTheDocument();
    });

    it("sends forceOpenEntityWindow for this entity with an 'all players' target by default", async () => {
      const { forceOpenEntityWindow } = setupQueries({
        members: ownerWithPlayersMembers,
      });
      setupDesktopWindows();
      const user = userEvent.setup();
      render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

      await user.click(
        screen.getByRole("button", { name: "Open for player(s)…" }),
      );
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(forceOpenEntityWindow).toHaveBeenCalledWith({
        input: {
          campaignId: "camp-1",
          entityId: "e-1",
          target: { allPlayers: true, userIds: [] },
        },
      });
    });

    it("sends forceOpenEntityWindow targeted at a single selected player", async () => {
      const { forceOpenEntityWindow } = setupQueries({
        members: ownerWithPlayersMembers,
      });
      setupDesktopWindows();
      const user = userEvent.setup();
      render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

      await user.click(
        screen.getByRole("button", { name: "Open for player(s)…" }),
      );
      await user.selectOptions(
        screen.getByRole("combobox", { name: "Open for player(s) target" }),
        "player-two@example.com",
      );
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(forceOpenEntityWindow).toHaveBeenCalledWith({
        input: {
          campaignId: "camp-1",
          entityId: "e-1",
          target: { allPlayers: false, userIds: ["user-2"] },
        },
      });
    });

    it("shows a success message once forceOpenEntityWindow resolves", async () => {
      setupQueries({ members: ownerWithPlayersMembers });
      setupDesktopWindows();
      const user = userEvent.setup();
      render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

      await user.click(
        screen.getByRole("button", { name: "Open for player(s)…" }),
      );
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(screen.getByText("Opened.")).toBeInTheDocument();
    });

    it("surfaces an error when forceOpenEntityWindow fails", async () => {
      setupQueries({
        members: ownerWithPlayersMembers,
        forceOpenEntityWindow: vi.fn().mockResolvedValue({ data: undefined }),
        forceOpenEntityWindowError: {
          graphQLErrors: [{ message: "You are not allowed to do that." }],
        } as never,
      });
      setupDesktopWindows();
      const user = userEvent.setup();
      render(<EntityWindow entity={ENTITY} campaignId="camp-1" />);

      await user.click(
        screen.getByRole("button", { name: "Open for player(s)…" }),
      );
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(
        screen.getByText("You are not allowed to do that."),
      ).toBeInTheDocument();
    });
  });
});
