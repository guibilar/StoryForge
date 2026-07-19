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
  updateEntity = vi.fn().mockImplementation(({ input }) =>
    Promise.resolve({
      data: { updateEntity: { id: input.id, color: input.color ?? null } },
    }),
  ),
  updateEntityFetching = false,
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
