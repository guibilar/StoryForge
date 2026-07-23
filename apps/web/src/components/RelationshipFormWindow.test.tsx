import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { RelationshipFormWindow } from "./RelationshipFormWindow";
import type { RelationshipRow } from "./RelationshipFormWindow";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  CampaignDocument,
  CreateRelationshipDocument,
  DeleteRelationshipDocument,
  MeDocument,
  UpdateRelationshipDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

const entities = [
  { id: "ent-1", name: "Lucien", type: "Vampire", category: "CHARACTER" },
  { id: "ent-2", name: "Camarilla", type: "Sect", category: "ORGANIZATION" },
  { id: "ent-3", name: "The Rack", type: "District", category: "LOCATION" },
];

const members = [
  { userId: "me", role: "OWNER", user: { id: "me", email: "gm@example.com" } },
  {
    userId: "player-1",
    role: "PLAYER",
    user: { id: "player-1", email: "player1@example.com" },
  },
];

function setupMocks({
  createRelationship = vi
    .fn()
    .mockResolvedValue({ data: { createRelationship: { id: "rel-2" } } }),
  updateRelationship = vi
    .fn()
    .mockResolvedValue({ data: { updateRelationship: {} } }),
  deleteRelationship = vi
    .fn()
    .mockResolvedValue({ data: { deleteRelationship: true } }),
  createFetching = false,
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === MeDocument) {
      return [
        {
          data: { me: { id: "me", email: "gm@example.com" } },
          fetching: false,
        },
        vi.fn(),
      ];
    }
    if (args.query === CampaignDocument) {
      return [
        { data: { campaign: { id: "camp-1", members } }, fetching: false },
        vi.fn(),
      ];
    }
    return [{ data: { entities }, fetching: false, stale: false }, vi.fn()];
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === CreateRelationshipDocument) {
      return [
        { fetching: createFetching, error: undefined, stale: false },
        createRelationship,
      ];
    }
    if (document === UpdateRelationshipDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        updateRelationship,
      ];
    }
    if (document === DeleteRelationshipDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        deleteRelationship,
      ];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { createRelationship, updateRelationship, deleteRelationship };
}

function renderCreate(onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <RelationshipFormWindow
      campaignId="camp-1"
      mode={{ mode: "create" }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

function renderEdit(
  relationship: RelationshipRow,
  onSaved = vi.fn(),
  onClose = vi.fn(),
) {
  render(
    <RelationshipFormWindow
      campaignId="camp-1"
      mode={{ mode: "edit", item: relationship }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

describe("RelationshipFormWindow", () => {
  it("creates a relationship between the chosen source and target", async () => {
    const { createRelationship } = setupMocks();
    const user = userEvent.setup();
    const { onSaved, onClose } = renderCreate();

    await user.selectOptions(screen.getByLabelText("Source"), "ent-1");
    await user.selectOptions(screen.getByLabelText("Target"), "ent-2");
    await user.type(screen.getByLabelText("Type"), "MemberOf");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createRelationship).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        sourceEntityId: "ent-1",
        targetEntityId: "ent-2",
        type: "MemberOf",
        description: null,
        visibility: "PUBLIC",
        concealedEndpoint: null,
      },
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("suggests category-appropriate types once source and target are chosen", async () => {
    setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.selectOptions(screen.getByLabelText("Source"), "ent-1");
    await user.selectOptions(screen.getByLabelText("Target"), "ent-2");

    const options = [
      ...document.querySelectorAll("#relationship-type-suggestions option"),
    ].map((option) => option.getAttribute("value"));
    expect(options).toEqual(["MemberOf"]);
  });

  it("rejects source and target being the same entity", async () => {
    const { createRelationship } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.selectOptions(screen.getByLabelText("Source"), "ent-1");
    await user.selectOptions(screen.getByLabelText("Target"), "ent-1");
    await user.type(screen.getByLabelText("Type"), "Ally");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Source and target must be different entities."),
    ).toBeInTheDocument();
    expect(createRelationship).not.toHaveBeenCalled();
  });

  it("shows a validation error instead of silently no-opping when Type is whitespace-only", async () => {
    // `required` alone doesn't stop a whitespace-only value (the browser
    // only checks the raw value is non-empty) — a genuinely empty value is
    // blocked by the browser's own constraint validation before the submit
    // handler ever runs, so this has to type whitespace to exercise the
    // handler's own trimmed check.
    const { createRelationship } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.selectOptions(screen.getByLabelText("Source"), "ent-1");
    await user.selectOptions(screen.getByLabelText("Target"), "ent-2");
    await user.type(screen.getByLabelText("Type"), "   ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Type is required.")).toBeInTheDocument();
    expect(createRelationship).not.toHaveBeenCalled();
  });

  it("shows source and target read-only in edit mode and updates only type/description", async () => {
    const { updateRelationship } = setupMocks();
    const user = userEvent.setup();
    const relationship: RelationshipRow = {
      id: "rel-1",
      sourceEntityId: "ent-1",
      targetEntityId: "ent-2",
      type: "MemberOf",
      description: "Sworn in.",
      visibility: "PUBLIC",
      recipientIds: [],
    };
    renderEdit(relationship);

    expect(screen.getByLabelText("Source")).toHaveValue("Lucien");
    expect(screen.getByLabelText("Source")).toBeDisabled();
    expect(screen.getByLabelText("Target")).toHaveValue("Camarilla");
    expect(screen.getByLabelText("Type")).toHaveValue("MemberOf");

    await user.clear(screen.getByLabelText("Type"));
    await user.type(screen.getByLabelText("Type"), "FormerMemberOf");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateRelationship).toHaveBeenCalledWith({
      input: {
        id: "rel-1",
        type: "FormerMemberOf",
        description: "Sworn in.",
      },
    });
  });

  it("targets a relationship at a specific player", async () => {
    const { createRelationship } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.selectOptions(screen.getByLabelText("Source"), "ent-1");
    await user.selectOptions(screen.getByLabelText("Target"), "ent-2");
    await user.type(screen.getByLabelText("Type"), "MemberOf");
    await user.selectOptions(screen.getByLabelText("Visibility"), "TARGETED");
    // Recipients checkboxes only appear for TARGETED; self is excluded.
    await user.click(screen.getByLabelText("player1@example.com"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createRelationship).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        sourceEntityId: "ent-1",
        targetEntityId: "ent-2",
        type: "MemberOf",
        description: null,
        visibility: "TARGETED",
        concealedEndpoint: null,
        recipientIds: ["player-1"],
      },
    });
  });

  it("blocks saving a targeted relationship with no recipients", async () => {
    const { createRelationship } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.selectOptions(screen.getByLabelText("Source"), "ent-1");
    await user.selectOptions(screen.getByLabelText("Target"), "ent-2");
    await user.type(screen.getByLabelText("Type"), "MemberOf");
    await user.selectOptions(screen.getByLabelText("Visibility"), "TARGETED");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createRelationship).not.toHaveBeenCalled();
  });

  it("creates a relationship with a concealed endpoint", async () => {
    const { createRelationship } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.selectOptions(screen.getByLabelText("Source"), "ent-1");
    await user.selectOptions(screen.getByLabelText("Target"), "ent-2");
    await user.type(screen.getByLabelText("Type"), "Blackmails");
    await user.selectOptions(
      screen.getByLabelText("Concealment"),
      "Hide target identity",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createRelationship).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        sourceEntityId: "ent-1",
        targetEntityId: "ent-2",
        type: "Blackmails",
        description: null,
        visibility: "PUBLIC",
        concealedEndpoint: "TARGET",
      },
    });
  });

  it("renders the concealment control in edit mode, and reveals a concealed endpoint", async () => {
    const { updateRelationship } = setupMocks();
    const user = userEvent.setup();
    const relationship: RelationshipRow = {
      id: "rel-1",
      sourceEntityId: "ent-1",
      targetEntityId: "ent-2",
      type: "Blackmails",
      description: null,
      visibility: "PUBLIC",
      recipientIds: [],
      concealedEndpoint: "TARGET",
    };
    renderEdit(relationship);

    expect(screen.getByLabelText("Concealment")).toHaveValue("TARGET");

    await user.selectOptions(
      screen.getByLabelText("Concealment"),
      "Fully revealed",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateRelationship).toHaveBeenCalledWith({
      input: {
        id: "rel-1",
        type: "Blackmails",
        description: null,
        concealedEndpoint: null,
      },
    });
  });

  it("omits concealedEndpoint from an update when it's unchanged", async () => {
    const { updateRelationship } = setupMocks();
    const user = userEvent.setup();
    const relationship: RelationshipRow = {
      id: "rel-1",
      sourceEntityId: "ent-1",
      targetEntityId: "ent-2",
      type: "Blackmails",
      description: null,
      visibility: "PUBLIC",
      recipientIds: [],
      concealedEndpoint: "SOURCE",
    };
    renderEdit(relationship);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateRelationship).toHaveBeenCalledWith({
      input: {
        id: "rel-1",
        type: "Blackmails",
        description: null,
      },
    });
  });

  it("deletes the relationship from edit mode", async () => {
    const { deleteRelationship } = setupMocks();
    const user = userEvent.setup();
    const relationship: RelationshipRow = {
      id: "rel-1",
      sourceEntityId: "ent-1",
      targetEntityId: "ent-2",
      type: "MemberOf",
      description: null,
      visibility: "PUBLIC",
      recipientIds: [],
    };
    const { onSaved, onClose } = renderEdit(relationship);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(deleteRelationship).toHaveBeenCalledWith({ id: "rel-1" });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose without saving when Cancel is clicked", async () => {
    const { createRelationship } = setupMocks();
    const user = userEvent.setup();
    const { onClose, onSaved } = renderCreate();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(createRelationship).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports loading to the window chrome while a save is in flight", () => {
    setupMocks({ createFetching: true });
    const chromeApi = { setLoading: vi.fn(), setOnRefresh: vi.fn() };
    render(
      <WindowChromeContext.Provider value={chromeApi}>
        <RelationshipFormWindow
          campaignId="camp-1"
          mode={{ mode: "create" }}
          onSaved={vi.fn()}
          onClose={vi.fn()}
        />
      </WindowChromeContext.Provider>,
    );

    expect(chromeApi.setLoading).toHaveBeenCalledWith(true);
  });
});
