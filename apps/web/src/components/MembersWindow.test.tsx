import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { MembersWindow } from "./MembersWindow";
import {
  AddCampaignMemberDocument,
  CampaignDocument,
  MeDocument,
  RemoveCampaignMemberDocument,
  UpdateCampaignMemberRoleDocument,
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
  {
    userId: "user-2",
    role: "PLAYER",
    user: { id: "user-2", email: "player@example.com" },
  },
];

function setupMocks({
  members = ownerMembers,
  addMember = vi.fn().mockResolvedValue({ data: { addCampaignMember: {} } }),
  removeMember = vi
    .fn()
    .mockResolvedValue({ data: { removeCampaignMember: true } }),
  updateRole = vi
    .fn()
    .mockResolvedValue({ data: { updateCampaignMemberRole: {} } }),
  reexecuteCampaign = vi.fn(),
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === MeDocument) {
      return [
        {
          data: { me: { id: CURRENT_USER_ID, email: "owner@example.com" } },
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
        reexecuteCampaign,
      ];
    }

    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === AddCampaignMemberDocument) {
      return [{ fetching: false, stale: false }, addMember];
    }
    if (document === RemoveCampaignMemberDocument) {
      return [{ fetching: false, stale: false }, removeMember];
    }
    if (document === UpdateCampaignMemberRoleDocument) {
      return [{ fetching: false, stale: false }, updateRole];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { addMember, removeMember, updateRole, reexecuteCampaign };
}

function renderWindow() {
  render(
    <MemoryRouter>
      <MembersWindow />
    </MemoryRouter>,
  );
}

describe("MembersWindow", () => {
  it("lists members with their email and role", () => {
    setupMocks();
    renderWindow();

    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("player@example.com")).toBeInTheDocument();
  });

  it("shows role selects, remove buttons, and an add-member form for an Owner", () => {
    setupMocks();
    renderWindow();

    expect(
      screen.getByLabelText("Role for owner@example.com"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Add member" }),
    ).toBeInTheDocument();
  });

  it("does not show a Remove button for the owner's own row", () => {
    setupMocks();
    renderWindow();

    const ownerRow = screen.getByText("owner@example.com").closest("li");
    expect(ownerRow).not.toBeNull();
    expect(
      within(ownerRow as HTMLElement).queryByRole("button", {
        name: "Remove",
      }),
    ).not.toBeInTheDocument();
  });

  it("hides all controls for a Storyteller (read-only)", () => {
    const members = [
      {
        userId: CURRENT_USER_ID,
        role: "STORYTELLER",
        user: { id: CURRENT_USER_ID, email: "storyteller@example.com" },
      },
      ownerMembers[1],
    ];
    setupMocks({ members });
    renderWindow();

    expect(screen.getByText("STORYTELLER")).toBeInTheDocument();
    expect(screen.getByText("PLAYER")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add member" }),
    ).not.toBeInTheDocument();
  });

  it("removes a member and refetches", async () => {
    const { removeMember, reexecuteCampaign } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(removeMember).toHaveBeenCalledWith({
      campaignId: "camp-1",
      userId: "user-2",
    });
    expect(reexecuteCampaign).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("changes a member's role and refetches", async () => {
    const { updateRole, reexecuteCampaign } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.selectOptions(
      screen.getByLabelText("Role for player@example.com"),
      "STORYTELLER",
    );

    expect(updateRole).toHaveBeenCalledWith({
      input: { campaignId: "camp-1", userId: "user-2", role: "STORYTELLER" },
    });
    expect(reexecuteCampaign).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });

  it("adds a member by email and resets the form", async () => {
    const { addMember, reexecuteCampaign } = setupMocks();
    const user = userEvent.setup();
    renderWindow();

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.selectOptions(screen.getByLabelText("Role"), "STORYTELLER");
    await user.click(screen.getByRole("button", { name: "Add member" }));

    expect(addMember).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        email: "new@example.com",
        role: "STORYTELLER",
      },
    });
    expect(reexecuteCampaign).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });
});
