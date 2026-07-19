import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation } from "urql";

import { EntityFormWindow } from "./EntityFormWindow";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import { CreateEntityDocument } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn() };
});

function setupMocks({
  createEntity = vi.fn().mockResolvedValue({ data: { createEntity: {} } }),
  fetching = false,
} = {}) {
  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === CreateEntityDocument) {
      return [{ fetching, error: undefined, stale: false }, createEntity];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { createEntity };
}

function renderWindow(onCreated = vi.fn(), onClose = vi.fn()) {
  render(
    <EntityFormWindow
      campaignId="camp-1"
      onCreated={onCreated}
      onClose={onClose}
    />,
  );
  return { onCreated, onClose };
}

describe("EntityFormWindow", () => {
  it("creates an entity and calls onCreated/onClose", async () => {
    const { createEntity } = setupMocks();
    const user = userEvent.setup();
    const { onCreated, onClose } = renderWindow();

    await user.type(screen.getByLabelText("Name"), "Lucien Dubois");
    await user.type(screen.getByLabelText("Type"), "Vampire");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(createEntity).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        type: "Vampire",
        category: "CHARACTER",
        name: "Lucien Dubois",
        description: null,
        visibility: "PUBLIC",
        isPlayerCharacter: false,
        color: null,
      },
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits isPlayerCharacter when checked on a CHARACTER entity", async () => {
    const { createEntity } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.type(screen.getByLabelText("Name"), "Lucien Dubois");
    await user.type(screen.getByLabelText("Type"), "Vampire");
    await user.click(screen.getByLabelText("Player Character"));
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(createEntity).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        type: "Vampire",
        category: "CHARACTER",
        name: "Lucien Dubois",
        description: null,
        visibility: "PUBLIC",
        isPlayerCharacter: true,
        color: null,
      },
    });
  });

  it("hides the Player Character checkbox for non-CHARACTER categories", async () => {
    const user = userEvent.setup();
    renderWindow();

    await user.selectOptions(screen.getByLabelText("Category"), "LOCATION");

    expect(screen.queryByLabelText("Player Character")).not.toBeInTheDocument();
  });

  it("hides the Map Color field for a non-map-linkable category", () => {
    renderWindow();

    expect(screen.queryByLabelText("Map Color")).not.toBeInTheDocument();
  });

  it("shows and submits a Map Color for a LOCATION entity", async () => {
    const { createEntity } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.selectOptions(screen.getByLabelText("Category"), "LOCATION");
    await user.type(screen.getByLabelText("Name"), "Thornwood");
    await user.type(screen.getByLabelText("Type"), "Forest");
    fireEvent.change(screen.getByLabelText("Map Color"), {
      target: { value: "#4287f5" },
    });
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(createEntity).toHaveBeenCalledWith({
      input: expect.objectContaining({
        category: "LOCATION",
        color: "#4287f5",
      }),
    });
  });

  it("clears a set Map Color when the category moves away from LOCATION/ORGANIZATION", async () => {
    const { createEntity } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.selectOptions(screen.getByLabelText("Category"), "LOCATION");
    fireEvent.change(screen.getByLabelText("Map Color"), {
      target: { value: "#4287f5" },
    });
    await user.selectOptions(screen.getByLabelText("Category"), "ITEM");
    await user.type(screen.getByLabelText("Name"), "Amulet");
    await user.type(screen.getByLabelText("Type"), "Relic");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(createEntity).toHaveBeenCalledWith({
      input: expect.objectContaining({ category: "ITEM", color: null }),
    });
  });

  it("does not submit without a name or type", async () => {
    const { createEntity } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    const form = screen
      .getByRole("button", { name: "Create" })
      .closest("form")!;
    // required fields block native submission via userEvent.click too, but
    // guard explicitly since the handler also checks name/type itself.
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(form).toBeInTheDocument();
    expect(createEntity).not.toHaveBeenCalled();
  });

  it("calls onClose without creating when Cancel is clicked", async () => {
    const { createEntity } = setupMocks();
    const user = userEvent.setup();
    const { onClose, onCreated } = renderWindow();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(createEntity).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports loading to the window chrome while a save is in flight", () => {
    setupMocks({ fetching: true });
    const chromeApi = { setLoading: vi.fn(), setOnRefresh: vi.fn() };
    render(
      <WindowChromeContext.Provider value={chromeApi}>
        <EntityFormWindow
          campaignId="camp-1"
          onCreated={vi.fn()}
          onClose={vi.fn()}
        />
      </WindowChromeContext.Provider>,
    );

    expect(chromeApi.setLoading).toHaveBeenCalledWith(true);
  });
});
