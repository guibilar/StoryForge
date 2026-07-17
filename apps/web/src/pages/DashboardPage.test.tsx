import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { DashboardPage } from "./DashboardPage";
import {
  ArchiveCampaignDocument,
  CampaignsDocument,
  CreateCampaignDocument,
  LogoutDocument,
  MeDocument,
  UpdateCampaignDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

const CURRENT_USER_ID = "user-1";

const campaigns = [
  {
    id: "c1",
    name: "Owned Campaign",
    description: "A campaign I own",
    archivedAt: null,
    members: [{ userId: CURRENT_USER_ID, role: "OWNER" }],
  },
  {
    id: "c2",
    name: "Joined Campaign",
    description: null,
    archivedAt: null,
    members: [
      { userId: CURRENT_USER_ID, role: "PLAYER" },
      { userId: "other-user", role: "OWNER" },
    ],
  },
];

function setupMocks({
  logout = vi.fn(),
  reexecuteCampaigns = vi.fn(),
  updateCampaign = vi
    .fn()
    .mockResolvedValue({ data: { updateCampaign: { id: "c1" } } }),
  archiveCampaign = vi
    .fn()
    .mockResolvedValue({ data: { archiveCampaign: true } }),
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === MeDocument) {
      return [
        {
          data: { me: { id: CURRENT_USER_ID, email: "me@example.com" } },
          fetching: false,
          stale: false,
        },
        vi.fn(),
      ];
    }

    if (args.query === CampaignsDocument) {
      return [
        { data: { campaigns }, fetching: false, stale: false },
        reexecuteCampaigns,
      ];
    }

    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === LogoutDocument) {
      return [{ fetching: false, stale: false }, logout];
    }

    if (document === CreateCampaignDocument) {
      return [{ fetching: false, stale: false }, vi.fn()];
    }

    if (document === UpdateCampaignDocument) {
      return [{ fetching: false, stale: false }, updateCampaign];
    }

    if (document === ArchiveCampaignDocument) {
      return [{ fetching: false, stale: false }, archiveCampaign];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { logout, reexecuteCampaigns, updateCampaign, archiveCampaign };
}

function renderDashboard() {
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("renders a card per campaign with member count and role", () => {
    setupMocks();
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: "Owned Campaign" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 member.*OWNER/)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Joined Campaign" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 members.*PLAYER/)).toBeInTheDocument();
  });

  it("shows an enabled Manage button only on owner-owned cards", () => {
    setupMocks();
    renderDashboard();

    const manageButtons = screen.getAllByRole("button", { name: "Manage" });
    expect(manageButtons).toHaveLength(1);
    expect(manageButtons[0]).toBeEnabled();
  });

  it("opens the manage-campaign modal prefilled with the campaign's data", async () => {
    setupMocks();
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole("button", { name: "Manage" }));

    const heading = screen.getByRole("heading", { name: "Manage campaign" });
    expect(heading).toBeInTheDocument();
    const dialog = within(heading.closest("dialog") as HTMLElement);
    expect(dialog.getByLabelText("Name")).toHaveValue("Owned Campaign");
  });

  it("closes the manage-campaign modal and refetches after saving", async () => {
    const { updateCampaign, reexecuteCampaigns } = setupMocks();
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole("button", { name: "Manage" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateCampaign).toHaveBeenCalled();
    expect(reexecuteCampaigns).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
    expect(
      screen.queryByRole("heading", { name: "Manage campaign" }),
    ).not.toBeInTheDocument();
  });

  it("closes the manage-campaign modal and refetches after archiving", async () => {
    const { archiveCampaign, reexecuteCampaigns } = setupMocks();
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole("button", { name: "Manage" }));
    await user.click(screen.getByRole("button", { name: "Archive campaign" }));
    await user.click(screen.getByRole("button", { name: "Confirm archive" }));

    expect(archiveCampaign).toHaveBeenCalledWith({ id: "c1" });
    expect(reexecuteCampaigns).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
    expect(
      screen.queryByRole("heading", { name: "Manage campaign" }),
    ).not.toBeInTheDocument();
  });

  it("logs out and navigates to /login", async () => {
    const { logout } = setupMocks();
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(logout).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });

  it("navigates to the campaign desktop when Enter campaign is clicked", async () => {
    setupMocks();
    const user = userEvent.setup();
    renderDashboard();

    const enterButtons = screen.getAllByRole("button", {
      name: "Enter",
    });
    expect(enterButtons).toHaveLength(2);

    await user.click(enterButtons[0]);

    expect(navigateMock).toHaveBeenCalledWith("/campaigns/c1");
  });

  it("opens the create-campaign dialog", async () => {
    setupMocks();
    const user = userEvent.setup();
    renderDashboard();

    const dialog = screen
      .getByText("New campaign", {
        selector: "h2",
      })
      .closest("dialog") as HTMLDialogElement | null;
    expect(dialog).not.toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "New campaign" }));

    expect(dialog).toHaveAttribute("open");
  });
});
