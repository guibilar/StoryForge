import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation } from "urql";

import { TerritoryFormWindow } from "./TerritoryFormWindow";
import type { TerritoryRow } from "./TerritoryFormWindow";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  CreateTerritoryDocument,
  DeleteTerritoryDocument,
  UpdateTerritoryDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn() };
});

const geometry = JSON.stringify({
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
});

function setupMocks({
  createTerritory = vi
    .fn()
    .mockResolvedValue({ data: { createTerritory: { id: "territory-2" } } }),
  updateTerritory = vi
    .fn()
    .mockResolvedValue({ data: { updateTerritory: {} } }),
  deleteTerritory = vi
    .fn()
    .mockResolvedValue({ data: { deleteTerritory: true } }),
  createFetching = false,
} = {}) {
  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === CreateTerritoryDocument) {
      return [
        { fetching: createFetching, error: undefined, stale: false },
        createTerritory,
      ];
    }
    if (document === UpdateTerritoryDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        updateTerritory,
      ];
    }
    if (document === DeleteTerritoryDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        deleteTerritory,
      ];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { createTerritory, updateTerritory, deleteTerritory };
}

function renderCreate(onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <TerritoryFormWindow
      campaignId="camp-1"
      mode={{ mode: "create" }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

function renderEdit(
  territory: TerritoryRow,
  onSaved = vi.fn(),
  onClose = vi.fn(),
) {
  render(
    <TerritoryFormWindow
      campaignId="camp-1"
      mode={{ mode: "edit", item: territory }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

describe("TerritoryFormWindow", () => {
  it("prefills the geometry from create-mode seed values", () => {
    setupMocks();
    const drawn = JSON.stringify(
      {
        type: "Polygon",
        coordinates: [
          [
            [2, 1],
            [4, 1],
            [4, 3],
            [2, 1],
          ],
        ],
      },
      null,
      2,
    );
    render(
      <TerritoryFormWindow
        campaignId="camp-1"
        mode={{ mode: "create", initial: { geometry: drawn } }}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // The drawn ring replaces the placeholder unit square, and stays
    // editable as the manual escape hatch.
    expect(screen.getByLabelText("Geometry (GeoJSON)")).toHaveValue(drawn);
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("creates a territory and calls onSaved/onClose", async () => {
    const { createTerritory } = setupMocks();
    const user = userEvent.setup();
    const { onSaved, onClose } = renderCreate();

    await user.type(screen.getByLabelText("Name"), "Thornwood");
    await user.type(screen.getByLabelText("Type"), "region");
    fireEvent.change(screen.getByLabelText("Geometry (GeoJSON)"), {
      target: { value: geometry },
    });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createTerritory).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        name: "Thornwood",
        type: "region",
        geometry,
        description: null,
      },
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed geometry JSON without submitting", async () => {
    const { createTerritory } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Name"), "Thornwood");
    await user.type(screen.getByLabelText("Type"), "region");
    fireEvent.change(screen.getByLabelText("Geometry (GeoJSON)"), {
      target: { value: "{not-json" },
    });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Geometry must be valid JSON."),
    ).toBeInTheDocument();
    expect(createTerritory).not.toHaveBeenCalled();
  });

  it("shows a validation error instead of silently no-opping when Name is whitespace-only", async () => {
    const { createTerritory } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Name"), "   ");
    await user.type(screen.getByLabelText("Type"), "region");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(createTerritory).not.toHaveBeenCalled();
  });

  it("shows a validation error instead of silently no-opping when Type is whitespace-only", async () => {
    const { createTerritory } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Name"), "Thornwood");
    await user.type(screen.getByLabelText("Type"), "   ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Type is required.")).toBeInTheDocument();
    expect(createTerritory).not.toHaveBeenCalled();
  });

  it("seeds the edit form with the territory's fields and deletes it", async () => {
    const territory: TerritoryRow = {
      id: "territory-1",
      name: "Thornwood",
      type: "region",
      geometry,
      description: "The forest north of the river.",
    };
    const { updateTerritory, deleteTerritory } = setupMocks();
    const user = userEvent.setup();
    const { onSaved, onClose } = renderEdit(territory);

    expect(screen.getByLabelText("Name")).toHaveValue("Thornwood");
    expect(screen.getByLabelText("Type")).toHaveValue("region");
    expect(screen.getByLabelText("Geometry (GeoJSON)")).toHaveValue(geometry);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(deleteTerritory).toHaveBeenCalledWith({ id: "territory-1" });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(updateTerritory).not.toHaveBeenCalled();
  });

  it("calls onClose without saving when Cancel is clicked", async () => {
    const { createTerritory } = setupMocks();
    const user = userEvent.setup();
    const { onClose, onSaved } = renderCreate();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(createTerritory).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not show a Delete button in create mode", () => {
    setupMocks();
    renderCreate();

    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("reports loading to the window chrome while a save is in flight", () => {
    setupMocks({ createFetching: true });
    const chromeApi = { setLoading: vi.fn(), setOnRefresh: vi.fn() };
    render(
      <WindowChromeContext.Provider value={chromeApi}>
        <TerritoryFormWindow
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
