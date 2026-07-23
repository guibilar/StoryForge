import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useMutation } from "urql";

import { MapExportImportModal } from "./MapExportImportModal";
import { CreateMarkerDocument, CreateTerritoryDocument } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn() };
});

const markers = [
  { id: "marker-1", name: "Old Mill", lat: 1, lng: 2, description: null },
];

const territories = [
  {
    id: "territory-1",
    name: "Thornwood",
    type: "region",
    geometry: JSON.stringify({ type: "Polygon", coordinates: [] }),
    description: "A dense forest.",
  },
];

function setupMocks({
  createMarker = vi
    .fn()
    .mockResolvedValue({ data: { createMarker: { id: "new-marker" } } }),
  createTerritory = vi
    .fn()
    .mockResolvedValue({ data: { createTerritory: { id: "new-territory" } } }),
} = {}) {
  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === CreateMarkerDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        createMarker,
      ];
    }
    if (document === CreateTerritoryDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        createTerritory,
      ];
    }
    throw new Error("Unexpected mutation in test");
  }) as never);

  return { createMarker, createTerritory };
}

// Blob/createObjectURL/anchor-click download aren't implemented in jsdom.
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let clickSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
  revokeObjectURL = vi.fn();
  URL.createObjectURL =
    createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL =
    revokeObjectURL as unknown as typeof URL.revokeObjectURL;
  clickSpy = vi.fn();
  HTMLAnchorElement.prototype.click =
    clickSpy as unknown as typeof HTMLAnchorElement.prototype.click;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderModal(
  props: Partial<Parameters<typeof MapExportImportModal>[0]> = {},
) {
  const onClose = vi.fn();
  const onImported = vi.fn();
  render(
    <MapExportImportModal
      campaignId="camp-1"
      campaignName="My Campaign!"
      markers={markers}
      territories={territories}
      onClose={onClose}
      onImported={onImported}
      {...props}
    />,
  );
  return { onClose, onImported };
}

describe("MapExportImportModal", () => {
  it("downloads a JSON export named after the campaign", async () => {
    setupMocks();
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Download as JSON" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    const text = await blob.text();
    const payload = JSON.parse(text);
    expect(payload.markers).toEqual([
      { name: "Old Mill", lat: 1, lng: 2, description: null },
    ]);
    expect(payload.territories).toEqual([
      {
        name: "Thornwood",
        type: "region",
        geometry: { type: "Polygon", coordinates: [] },
        description: "A dense forest.",
      },
    ]);
  });

  it("disables the export button when there's nothing to export", () => {
    setupMocks();
    renderModal({ markers: [], territories: [] });

    expect(
      screen.getByRole("button", { name: "Download as JSON" }),
    ).toBeDisabled();
  });

  it("imports markers and territories from a valid export file", async () => {
    const { createMarker, createTerritory } = setupMocks();
    const user = userEvent.setup();
    const { onImported } = renderModal();

    const file = new File(
      [
        JSON.stringify({
          format: "storyforge.geo-map-export",
          version: 1,
          markers: [{ name: "New Marker", lat: 5, lng: 6, description: "x" }],
          territories: [
            {
              name: "New Territory",
              type: "district",
              geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
              description: null,
            },
          ],
        }),
      ],
      "export.json",
      { type: "application/json" },
    );
    const input = document.querySelector('input[type="file"]');
    await user.upload(input as HTMLInputElement, file);

    expect(createMarker).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        name: "New Marker",
        lat: 5,
        lng: 6,
        description: "x",
      },
    });
    expect(createTerritory).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        name: "New Territory",
        type: "district",
        geometry: JSON.stringify({ type: "Polygon", coordinates: [[[0, 0]]] }),
        description: null,
      },
    });
    expect(
      await screen.findByText("Imported 1 marker and 1 territory."),
    ).toBeInTheDocument();
    expect(onImported).toHaveBeenCalled();
  });

  it("shows an error for a file that isn't valid JSON", async () => {
    setupMocks();
    const user = userEvent.setup();
    renderModal();

    const file = new File(["not json"], "export.json", {
      type: "application/json",
    });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input as HTMLInputElement, file);

    expect(
      await screen.findByText("That file isn't valid JSON."),
    ).toBeInTheDocument();
  });

  it("shows an error for a well-formed JSON file with no usable markers or territories", async () => {
    setupMocks();
    const user = userEvent.setup();
    renderModal();

    const file = new File(
      [JSON.stringify({ markers: [], territories: [] })],
      "export.json",
      {
        type: "application/json",
      },
    );
    const input = document.querySelector('input[type="file"]');
    await user.upload(input as HTMLInputElement, file);

    expect(
      await screen.findByText(
        "That file doesn't contain any readable markers or territories.",
      ),
    ).toBeInTheDocument();
  });

  it("counts failed creations without aborting the rest of the import", async () => {
    setupMocks({
      createMarker: vi
        .fn()
        .mockResolvedValueOnce({ data: undefined })
        .mockResolvedValueOnce({ data: { createMarker: { id: "m2" } } }),
    });
    const user = userEvent.setup();
    renderModal();

    const file = new File(
      [
        JSON.stringify({
          markers: [
            { name: "Bad", lat: 1, lng: 1 },
            { name: "Good", lat: 2, lng: 2 },
          ],
        }),
      ],
      "export.json",
      { type: "application/json" },
    );
    const input = document.querySelector('input[type="file"]');
    await user.upload(input as HTMLInputElement, file);

    expect(
      await screen.findByText(
        "Imported 1 marker and 0 territories. 1 item failed to import.",
      ),
    ).toBeInTheDocument();
  });

  it("calls onClose when Close is clicked", async () => {
    setupMocks();
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });
});
