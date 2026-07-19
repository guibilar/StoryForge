import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation } from "urql";

import { ForceOpenEntityAction } from "./ForceOpenEntityAction";
import { ForceOpenEntityWindowDocument } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn() };
});

const MEMBERS = [
  {
    userId: "user-1",
    role: "OWNER" as const,
    user: { email: "owner@example.com" },
  },
  {
    userId: "user-2",
    role: "PLAYER" as const,
    user: { email: "player-two@example.com" },
  },
  {
    userId: "user-3",
    role: "OBSERVER" as const,
    user: { email: "observer@example.com" },
  },
];

function setupMutation({
  forceOpenEntityWindow = vi
    .fn()
    .mockResolvedValue({ data: { forceOpenEntityWindow: true } }),
  fetching = false,
  error = undefined as { graphQLErrors: unknown[] } | undefined,
} = {}) {
  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === ForceOpenEntityWindowDocument) {
      return [{ fetching, error, stale: false }, forceOpenEntityWindow];
    }
    throw new Error("Unexpected mutation in test");
  }) as never);
  return { forceOpenEntityWindow };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ForceOpenEntityAction", () => {
  it("starts collapsed, showing only the trigger button", () => {
    setupMutation();
    render(
      <ForceOpenEntityAction
        campaignId="camp-1"
        entityId="e-1"
        members={MEMBERS}
        idPrefix="test"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Open for player(s)…" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("expands to show the target picker and Send/Cancel controls when clicked", async () => {
    setupMutation();
    const user = userEvent.setup();
    render(
      <ForceOpenEntityAction
        campaignId="camp-1"
        entityId="e-1"
        members={MEMBERS}
        idPrefix="test"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Open for player(s)…" }),
    );

    expect(
      screen.getByRole("combobox", { name: "Open for player(s) target" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("collapses back to just the trigger when Cancel is clicked", async () => {
    setupMutation();
    const user = userEvent.setup();
    render(
      <ForceOpenEntityAction
        campaignId="camp-1"
        entityId="e-1"
        members={MEMBERS}
        idPrefix="test"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Open for player(s)…" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("button", { name: "Open for player(s)…" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("sends forceOpenEntityWindow with an 'all players' target by default", async () => {
    const { forceOpenEntityWindow } = setupMutation();
    const user = userEvent.setup();
    render(
      <ForceOpenEntityAction
        campaignId="camp-1"
        entityId="e-1"
        members={MEMBERS}
        idPrefix="test"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Open for player(s)…" }),
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(forceOpenEntityWindow).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        entityId: "e-1",
        target: { allPlayers: true, userIds: [] },
      },
    });
  });

  it("sends forceOpenEntityWindow targeted at a single selected player", async () => {
    const { forceOpenEntityWindow } = setupMutation();
    const user = userEvent.setup();
    render(
      <ForceOpenEntityAction
        campaignId="camp-1"
        entityId="e-1"
        members={MEMBERS}
        idPrefix="test"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Open for player(s)…" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Open for player(s) target" }),
      "player-two@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(forceOpenEntityWindow).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        entityId: "e-1",
        target: { allPlayers: false, userIds: ["user-2"] },
      },
    });
  });

  it("shows a success message once forceOpenEntityWindow resolves", async () => {
    setupMutation();
    const user = userEvent.setup();
    render(
      <ForceOpenEntityAction
        campaignId="camp-1"
        entityId="e-1"
        members={MEMBERS}
        idPrefix="test"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Open for player(s)…" }),
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText("Opened.")).toBeInTheDocument();
  });

  it("surfaces an error when forceOpenEntityWindow fails", async () => {
    setupMutation({
      forceOpenEntityWindow: vi.fn().mockResolvedValue({ data: undefined }),
      error: {
        graphQLErrors: [{ message: "You are not allowed to do that." }],
      } as never,
    });
    const user = userEvent.setup();
    render(
      <ForceOpenEntityAction
        campaignId="camp-1"
        entityId="e-1"
        members={MEMBERS}
        idPrefix="test"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Open for player(s)…" }),
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      screen.getByText("You are not allowed to do that."),
    ).toBeInTheDocument();
  });
});
