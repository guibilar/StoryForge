import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation } from "urql";

import { ManageCampaignModal } from "./ManageCampaignModal";
import {
  ArchiveCampaignDocument,
  UpdateCampaignDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn() };
});

const campaign = { id: "camp-1", name: "Old Name", description: "Old desc" };

function setupMocks({
  updateCampaign = vi
    .fn()
    .mockResolvedValue({ data: { updateCampaign: { id: "camp-1" } } }),
  archiveCampaign = vi
    .fn()
    .mockResolvedValue({ data: { archiveCampaign: true } }),
} = {}) {
  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === UpdateCampaignDocument) {
      return [{ fetching: false, stale: false }, updateCampaign];
    }
    if (document === ArchiveCampaignDocument) {
      return [{ fetching: false, stale: false }, archiveCampaign];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { updateCampaign, archiveCampaign };
}

function renderModal(
  overrides: Partial<Parameters<typeof ManageCampaignModal>[0]> = {},
) {
  const onClose = vi.fn();
  const onUpdated = vi.fn();
  const onArchived = vi.fn();

  render(
    <ManageCampaignModal
      open
      campaign={campaign}
      onClose={onClose}
      onUpdated={onUpdated}
      onArchived={onArchived}
      {...overrides}
    />,
  );

  return { onClose, onUpdated, onArchived };
}

describe("ManageCampaignModal", () => {
  it("prefills name and description from the campaign", () => {
    setupMocks();
    renderModal();

    expect(screen.getByLabelText("Name")).toHaveValue("Old Name");
    expect(screen.getByLabelText("Description")).toHaveValue("Old desc");
  });

  it("submits updated name/description and calls onUpdated", async () => {
    const { updateCampaign } = setupMocks();
    const { onUpdated } = renderModal();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "New Name");
    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "New desc");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateCampaign).toHaveBeenCalledWith({
      input: { id: "camp-1", name: "New Name", description: "New desc" },
    });
    expect(onUpdated).toHaveBeenCalled();
  });

  it("closes without saving on Cancel", async () => {
    setupMocks();
    const { onClose } = renderModal();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("requires a confirm step before archiving", async () => {
    const { archiveCampaign } = setupMocks();
    renderModal();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Archive campaign" }));

    expect(archiveCampaign).not.toHaveBeenCalled();
    expect(screen.getByText(/Archive "Old Name"\?/)).toBeInTheDocument();
  });

  it("archives after confirming and calls onArchived", async () => {
    const { archiveCampaign } = setupMocks();
    const { onArchived } = renderModal();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Archive campaign" }));
    await user.click(screen.getByRole("button", { name: "Confirm archive" }));

    expect(archiveCampaign).toHaveBeenCalledWith({ id: "camp-1" });
    expect(onArchived).toHaveBeenCalled();
  });

  it("backs out of the archive confirmation without archiving", async () => {
    const { archiveCampaign } = setupMocks();
    renderModal();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Archive campaign" }));
    await user.click(screen.getByRole("button", { name: "Never mind" }));

    expect(archiveCampaign).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Archive campaign" }),
    ).toBeInTheDocument();
  });
});
