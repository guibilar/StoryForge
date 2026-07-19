import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { MarkerFormWindow } from "./MarkerFormWindow";
import type { MarkerRow } from "./MarkerFormWindow";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import { CreateMarkerDocument, UpdateMarkerDocument } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

function setupMocks({
  createMarker = vi
    .fn()
    .mockResolvedValue({ data: { createMarker: { id: "marker-2" } } }),
  updateMarker = vi.fn().mockResolvedValue({ data: { updateMarker: {} } }),
  createFetching = false,
  entities = [] as {
    id: string;
    name: string;
    type: string;
    category: string;
  }[],
} = {}) {
  // EntitySelectField loads the campaign's entities for the link picker.
  vi.mocked(useQuery).mockReturnValue([
    { data: { entities }, fetching: false, stale: false },
    vi.fn(),
  ] as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === CreateMarkerDocument) {
      return [
        { fetching: createFetching, error: undefined, stale: false },
        createMarker,
      ];
    }
    if (document === UpdateMarkerDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        updateMarker,
      ];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { createMarker, updateMarker };
}

function renderCreate(onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <MarkerFormWindow
      campaignId="camp-1"
      mode={{ mode: "create" }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

function renderEdit(marker: MarkerRow, onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <MarkerFormWindow
      campaignId="camp-1"
      mode={{ mode: "edit", item: marker }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

describe("MarkerFormWindow", () => {
  it("defaults the coordinates to 0 when create mode has no seed values", () => {
    setupMocks();
    renderCreate();

    expect(screen.getByLabelText("Latitude")).toHaveValue(0);
    expect(screen.getByLabelText("Longitude")).toHaveValue(0);
  });

  it("prefills the coordinates from create-mode seed values", () => {
    setupMocks();
    render(
      <MarkerFormWindow
        campaignId="camp-1"
        mode={{ mode: "create", initial: { lat: 51.505, lng: -0.09 } }}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Latitude")).toHaveValue(51.505);
    expect(screen.getByLabelText("Longitude")).toHaveValue(-0.09);
    // Only the coordinates are seeded — the user still names the marker.
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("accepts seeded pixel coordinates from a custom map image", async () => {
    const { createMarker } = setupMocks();
    const user = userEvent.setup();
    render(
      <MarkerFormWindow
        campaignId="camp-1"
        mode={{ mode: "create", initial: { lat: 1387.5, lng: 1902.25 } }}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Watchtower");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Far outside geographic ranges — these must survive to the mutation
    // rather than being clamped or rejected.
    expect(createMarker).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        name: "Watchtower",
        lat: 1387.5,
        lng: 1902.25,
        description: null,
        entityId: null,
      },
    });
  });

  it("creates a marker and calls onSaved/onClose", async () => {
    const { createMarker } = setupMocks();
    const user = userEvent.setup();
    const { onSaved, onClose } = renderCreate();

    await user.type(screen.getByLabelText("Name"), "Old Mill");
    await user.clear(screen.getByLabelText("Latitude"));
    await user.type(screen.getByLabelText("Latitude"), "51.505");
    await user.clear(screen.getByLabelText("Longitude"));
    await user.type(screen.getByLabelText("Longitude"), "-0.09");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createMarker).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        name: "Old Mill",
        lat: 51.505,
        lng: -0.09,
        description: null,
        entityId: null,
      },
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("seeds the edit form with the marker's fields", async () => {
    const marker: MarkerRow = {
      id: "marker-1",
      name: "Old Mill",
      lat: 51.505,
      lng: -0.09,
      description: "Abandoned mill",
    };
    const { updateMarker } = setupMocks();
    const user = userEvent.setup();
    renderEdit(marker);

    expect(screen.getByLabelText("Name")).toHaveValue("Old Mill");
    expect(screen.getByLabelText("Latitude")).toHaveValue(51.505);
    expect(screen.getByLabelText("Longitude")).toHaveValue(-0.09);
    expect(screen.getByLabelText("Description")).toHaveValue("Abandoned mill");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "New Mill");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateMarker).toHaveBeenCalledWith({
      input: {
        id: "marker-1",
        name: "New Mill",
        lat: 51.505,
        lng: -0.09,
        description: "Abandoned mill",
        entityId: null,
      },
    });
  });

  it("shows a validation error instead of silently no-opping when Name is whitespace-only", async () => {
    const { createMarker } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Name"), "   ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(createMarker).not.toHaveBeenCalled();
  });

  it("accepts coordinates well outside real-world geographic ranges (pixel space under a custom map image)", async () => {
    const { createMarker } = setupMocks();
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Name"), "Throne Room");
    await user.clear(screen.getByLabelText("Latitude"));
    await user.type(screen.getByLabelText("Latitude"), "1200");
    await user.clear(screen.getByLabelText("Longitude"));
    await user.type(screen.getByLabelText("Longitude"), "900");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createMarker).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        name: "Throne Room",
        lat: 1200,
        lng: 900,
        description: null,
        entityId: null,
      },
    });
  });

  it("calls onClose without saving when Cancel is clicked", async () => {
    const { createMarker } = setupMocks();
    const user = userEvent.setup();
    const { onClose, onSaved } = renderCreate();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(createMarker).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports loading to the window chrome while a save is in flight", () => {
    setupMocks({ createFetching: true });
    const chromeApi = { setLoading: vi.fn(), setOnRefresh: vi.fn() };
    render(
      <WindowChromeContext.Provider value={chromeApi}>
        <MarkerFormWindow
          campaignId="camp-1"
          mode={{ mode: "create" }}
          onSaved={vi.fn()}
          onClose={vi.fn()}
        />
      </WindowChromeContext.Provider>,
    );

    expect(chromeApi.setLoading).toHaveBeenCalledWith(true);
  });

  it("links the marker to the chosen entity", async () => {
    const { createMarker } = setupMocks({
      entities: [
        {
          id: "entity-1",
          name: "Riverwood",
          type: "location",
          category: "LOCATION",
        },
        {
          id: "entity-2",
          name: "Ashfen Village",
          type: "location",
          category: "LOCATION",
        },
      ],
    });
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Name"), "Old Mill");
    await user.selectOptions(screen.getByLabelText("Entity"), "entity-2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createMarker).toHaveBeenCalledWith({
      input: expect.objectContaining({ entityId: "entity-2" }),
    });
  });

  it("excludes non-LOCATION entities from the picker", () => {
    setupMocks({
      entities: [
        {
          id: "entity-1",
          name: "Riverwood",
          type: "location",
          category: "LOCATION",
        },
        {
          id: "entity-2",
          name: "Bandit Chief",
          type: "npc",
          category: "CHARACTER",
        },
      ],
    });
    renderCreate();

    const options = screen.getByLabelText("Entity").querySelectorAll("option");
    const names = [...options].map((option) => option.textContent);

    expect(names).toContain("Riverwood");
    expect(names).not.toContain("Bandit Chief");
  });

  it("submits null rather than an empty string when left unlinked", async () => {
    const { createMarker } = setupMocks({
      entities: [
        {
          id: "entity-1",
          name: "Riverwood",
          type: "location",
          category: "LOCATION",
        },
      ],
    });
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByLabelText("Name"), "Old Mill");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // The picker's "None" option has an empty-string value; the API needs a
    // real null to mean unlinked.
    expect(createMarker).toHaveBeenCalledWith({
      input: expect.objectContaining({ entityId: null }),
    });
  });

  it("preselects the existing link when editing and can clear it", async () => {
    const { updateMarker } = setupMocks({
      entities: [
        {
          id: "entity-1",
          name: "Riverwood",
          type: "location",
          category: "LOCATION",
        },
      ],
    });
    const user = userEvent.setup();
    renderEdit({
      id: "marker-1",
      name: "Old Mill",
      lat: 1,
      lng: 2,
      entityId: "entity-1",
    });

    expect(screen.getByLabelText("Entity")).toHaveValue("entity-1");

    await user.selectOptions(screen.getByLabelText("Entity"), "");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateMarker).toHaveBeenCalledWith({
      input: expect.objectContaining({ entityId: null }),
    });
  });
});
