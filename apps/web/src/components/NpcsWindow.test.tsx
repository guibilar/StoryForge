import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { NpcsWindow } from "./NpcsWindow";
import {
  CampaignDocument,
  CreateEntityDocument,
  DeleteEntityDocument,
  EntitiesDocument,
  MeDocument,
  UpdateEntityDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ id: "camp-1" }) };
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

const npcs = [
  {
    id: "npc-1",
    name: "Goblin",
    description: "A sneaky goblin",
    visibility: "PUBLIC",
    tags: [{ id: "tag-1", name: "combat" }],
  },
  {
    id: "npc-2",
    name: "Hidden Sage",
    description: null,
    visibility: "STORYTELLER",
    tags: [],
  },
];

function setupMocks({
  members = ownerMembers,
  entities = npcs,
  createEntity = vi.fn().mockResolvedValue({ data: { createEntity: {} } }),
  updateEntity = vi.fn().mockResolvedValue({ data: { updateEntity: {} } }),
  deleteEntity = vi.fn().mockResolvedValue({ data: { deleteEntity: true } }),
  reexecuteEntities = vi.fn(),
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
        {
          data: { entities },
          fetching: false,
          stale: false,
        },
        reexecuteEntities,
      ];
    }

    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === CreateEntityDocument) {
      return [{ fetching: false, stale: false }, createEntity];
    }
    if (document === UpdateEntityDocument) {
      return [{ fetching: false, stale: false }, updateEntity];
    }
    if (document === DeleteEntityDocument) {
      return [{ fetching: false, stale: false }, deleteEntity];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { createEntity, updateEntity, deleteEntity, reexecuteEntities };
}

function renderWindow() {
  render(
    <MemoryRouter>
      <NpcsWindow />
    </MemoryRouter>,
  );
}

describe("NpcsWindow", () => {
  it("lists NPCs with visibility and tag chips", () => {
    setupMocks();
    renderWindow();

    expect(screen.getByText("Goblin")).toBeInTheDocument();
    expect(screen.getByText("Hidden Sage")).toBeInTheDocument();
    expect(screen.getByText("PUBLIC")).toBeInTheDocument();
    expect(screen.getByText("combat")).toBeInTheDocument();
  });

  it("shows create/edit/delete controls for an Owner", () => {
    setupMocks();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "+ New NPC" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("shows create/edit/delete controls for a Storyteller", () => {
    const members = [
      {
        userId: CURRENT_USER_ID,
        role: "STORYTELLER",
        user: { id: CURRENT_USER_ID, email: "storyteller@example.com" },
      },
    ];
    setupMocks({ members });
    renderWindow();

    expect(
      screen.getByRole("button", { name: "+ New NPC" }),
    ).toBeInTheDocument();
  });

  it("shows create/edit/delete controls for a Co-Storyteller", () => {
    const members = [
      {
        userId: CURRENT_USER_ID,
        role: "CO_STORYTELLER",
        user: { id: CURRENT_USER_ID, email: "co-storyteller@example.com" },
      },
    ];
    setupMocks({ members });
    renderWindow();

    expect(
      screen.getByRole("button", { name: "+ New NPC" }),
    ).toBeInTheDocument();
  });

  it("hides all controls for a Player (read-only)", () => {
    setupMocks({ members: playerMembers });
    renderWindow();

    expect(screen.getByText("Goblin")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ New NPC" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("creates an NPC via the modal form and refetches", async () => {
    const { createEntity, reexecuteEntities } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ New NPC" }));
    await user.type(screen.getByLabelText("Name"), "New Goblin");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createEntity).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        type: "NPC",
        name: "New Goblin",
        description: null,
        visibility: "PUBLIC",
      },
    });
    expect(reexecuteEntities).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("edits an NPC via the modal form pre-filled with its data", async () => {
    const { updateEntity, reexecuteEntities } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByLabelText("Name")).toHaveValue("Goblin");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Renamed Goblin");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateEntity).toHaveBeenCalledWith({
      input: {
        id: "npc-1",
        name: "Renamed Goblin",
        description: "A sneaky goblin",
        visibility: "PUBLIC",
      },
    });
    expect(reexecuteEntities).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("deletes an NPC after confirming and refetches", async () => {
    const { deleteEntity, reexecuteEntities } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(deleteEntity).toHaveBeenCalledWith({ id: "npc-1" });
    expect(reexecuteEntities).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });
});
