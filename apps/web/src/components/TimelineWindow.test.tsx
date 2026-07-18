import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { TimelineWindow } from "./TimelineWindow";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import {
  CampaignDocument,
  DeleteEventDocument,
  EntitiesDocument,
  EventsDocument,
  MeDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ id: "camp-1" }) };
});

vi.mock("../lib/DesktopWindowsContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/DesktopWindowsContext")>();
  return { ...actual, useDesktopWindows: vi.fn() };
});

const CURRENT_USER_ID = "user-1";

const ownerMembers = [
  {
    userId: CURRENT_USER_ID,
    role: "OWNER",
    user: { id: CURRENT_USER_ID, email: "owner@example.com" },
  },
];

const playerMembers = [
  {
    userId: CURRENT_USER_ID,
    role: "PLAYER",
    user: { id: CURRENT_USER_ID, email: "player@example.com" },
  },
];

const entities = [
  {
    id: "npc-1",
    name: "Theo Vance",
    description: null,
    visibility: "PUBLIC",
    tags: [],
  },
  {
    id: "npc-2",
    name: "Sister Agnes",
    description: null,
    visibility: "PUBLIC",
    tags: [],
  },
];

const events = [
  {
    id: "event-1",
    campaignId: "camp-1",
    title: "Coterie forms an uneasy alliance",
    description: "They agreed to a truce.",
    occurredAt: "Day 1",
    sessionId: null,
    session: null,
    participants: [{ id: "npc-1", name: "Theo Vance" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "event-2",
    campaignId: "camp-1",
    title: "Blood debt struck with the Prince",
    description: null,
    occurredAt: "Day 2",
    sessionId: "sess-1",
    session: { id: "sess-1", sessionNumber: 11 },
    participants: [{ id: "npc-2", name: "Sister Agnes" }],
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

function setupMocks({
  members = ownerMembers,
  eventList = events,
  deleteEvent = vi.fn().mockResolvedValue({ data: { deleteEvent: true } }),
  reexecuteEvents = vi.fn(),
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === MeDocument) {
      return [
        {
          data: { me: { id: CURRENT_USER_ID, email: "member@example.com" } },
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
        vi.fn(),
      ];
    }

    if (args.query === EventsDocument) {
      return [
        { data: { events: eventList }, fetching: false, stale: false },
        reexecuteEvents,
      ];
    }

    if (args.query === EntitiesDocument) {
      return [{ data: { entities }, fetching: false, stale: false }, vi.fn()];
    }

    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === DeleteEventDocument) {
      return [{ fetching: false, error: undefined, stale: false }, deleteEvent];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { deleteEvent, reexecuteEvents };
}

function setupDesktopWindows() {
  const openWindow = vi.fn();
  const closeWindow = vi.fn();
  vi.mocked(useDesktopWindows).mockReturnValue({
    layout: {},
    bringToFront: vi.fn(),
    toggle: vi.fn(),
    startDrag: vi.fn(),
    startResize: vi.fn(),
    reset: vi.fn(),
    dynamicWindows: {},
    openWindow,
    closeWindow,
    recentIds: [],
    presets: {},
    savePreset: vi.fn(),
    applyPreset: vi.fn(),
    hydrateFromServer: vi.fn(),
  });
  return { openWindow, closeWindow };
}

function renderWindow() {
  render(
    <MemoryRouter>
      <TimelineWindow />
    </MemoryRouter>,
  );
}

describe("TimelineWindow", () => {
  it("lists events in occurredAt order with participant and session chips", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByText("Coterie forms an uneasy alliance"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Blood debt struck with the Prince"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Theo Vance").length).toBeGreaterThan(0);
    expect(screen.getByText("#11")).toBeInTheDocument();
  });

  it("shows create/edit/delete controls for an Owner", () => {
    setupMocks();
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByRole("button", { name: "+ New event" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("hides write controls for a Player (read-only)", () => {
    setupMocks({ members: playerMembers });
    setupDesktopWindows();
    renderWindow();

    expect(
      screen.getByText("Coterie forms an uneasy alliance"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ New event" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("filters events by search text", async () => {
    setupMocks();
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.type(screen.getByLabelText("Search events"), "blood debt");

    expect(
      screen.queryByText("Coterie forms an uneasy alliance"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Blood debt struck with the Prince"),
    ).toBeInTheDocument();
  });

  it("filters events by participant", async () => {
    setupMocks();
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.selectOptions(
      screen.getByLabelText("Filter by participant"),
      "npc-2",
    );

    expect(
      screen.queryByText("Coterie forms an uneasy alliance"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Blood debt struck with the Prince"),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no events", () => {
    setupMocks({ eventList: [] });
    setupDesktopWindows();
    renderWindow();

    expect(screen.getByText("No events yet.")).toBeInTheDocument();
  });

  it("opens a create window when + New event is clicked", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getByRole("button", { name: "+ New event" }));

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "event-form:new", title: "New Event" }),
    );
  });

  it("opens an edit window when Edit is clicked", async () => {
    setupMocks();
    const { openWindow } = setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-form:event-1",
        title: "Edit: Coterie forms an uneasy alliance",
      }),
    );
  });

  it("deletes an event after confirming and refetches", async () => {
    const { deleteEvent, reexecuteEvents } = setupMocks();
    setupDesktopWindows();
    const user = userEvent.setup();
    renderWindow();

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(deleteEvent).toHaveBeenCalledWith({ id: "event-1" });
    expect(reexecuteEvents).toHaveBeenCalledWith({
      requestPolicy: "network-only",
    });
  });
});
