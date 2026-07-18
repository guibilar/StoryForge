import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation } from "urql";

import { EntityFormWindow } from "./EntityFormWindow";
import { CreateEntityDocument } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn() };
});

function setupMocks({
  createEntity = vi.fn().mockResolvedValue({ data: { createEntity: {} } }),
} = {}) {
  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === CreateEntityDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        createEntity,
      ];
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
    await user.type(screen.getByLabelText("Type"), "Character");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(createEntity).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        type: "Character",
        name: "Lucien Dubois",
        description: null,
        visibility: "PUBLIC",
      },
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
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
});
