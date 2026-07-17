import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useMutation, useQuery } from "urql";
import { vi } from "vitest";

import { MobileDesktop } from "./MobileDesktop";
import { CampaignDocument, EntitiesDocument, MeDocument } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ id: "camp-1" }) };
});

vi.mocked(useMutation).mockImplementation((() => [
  { fetching: false, stale: false },
  vi.fn(),
]) as never);

vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
  if (args.query === MeDocument) {
    return [
      {
        data: { me: { id: "user-1", email: "me@example.com" } },
        fetching: false,
        stale: false,
      },
      vi.fn(),
    ];
  }

  if (args.query === CampaignDocument) {
    return [
      {
        data: {
          campaign: {
            id: "camp-1",
            name: "Campaign",
            members: [
              {
                userId: "user-1",
                role: "OWNER",
                user: { id: "user-1", email: "me@example.com" },
              },
            ],
          },
        },
        fetching: false,
        stale: false,
      },
      vi.fn(),
    ];
  }

  if (args.query === EntitiesDocument) {
    return [{ data: { entities: [] }, fetching: false, stale: false }, vi.fn()];
  }

  throw new Error("Unexpected query in test");
}) as never);

function renderMobileDesktop() {
  render(
    <MemoryRouter>
      <MobileDesktop />
    </MemoryRouter>,
  );
}

describe("MobileDesktop", () => {
  it("shows the first catalog window's panel by default", () => {
    renderMobileDesktop();

    expect(screen.getByRole("heading", { name: "NPCs" })).toBeInTheDocument();
  });

  it("switches panels when a tab is clicked", async () => {
    const user = userEvent.setup();
    renderMobileDesktop();

    await user.click(screen.getByRole("button", { name: "Timeline" }));

    expect(
      screen.getByRole("heading", { name: "Timeline" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Coming soon — KAN-49.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "NPCs" }),
    ).not.toBeInTheDocument();
  });

  it("marks the active tab with aria-pressed", async () => {
    const user = userEvent.setup();
    renderMobileDesktop();

    await user.click(screen.getByRole("button", { name: "Sessions" }));

    expect(screen.getByRole("button", { name: "Sessions" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "NPCs" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
