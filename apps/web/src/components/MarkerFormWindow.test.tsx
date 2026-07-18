import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation } from "urql";

import { MarkerFormWindow } from "./MarkerFormWindow";
import type { MarkerRow } from "./MarkerFormWindow";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import { CreateMarkerDocument, UpdateMarkerDocument } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn() };
});

function setupMocks({
  createMarker = vi
    .fn()
    .mockResolvedValue({ data: { createMarker: { id: "marker-2" } } }),
  updateMarker = vi.fn().mockResolvedValue({ data: { updateMarker: {} } }),
  createFetching = false,
} = {}) {
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
});
