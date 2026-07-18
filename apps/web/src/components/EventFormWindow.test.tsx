import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { EventFormWindow } from "./EventFormWindow";
import type { EventRow } from "./EventFormWindow";
import {
  AttachParticipantDocument,
  CreateEventDocument,
  DetachParticipantDocument,
  EntitiesDocument,
  SessionsDocument,
  UpdateEventDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

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

const sessions = [{ id: "sess-1", sessionNumber: 11, date: "2026-06-29" }];

function setupMocks({
  createEvent = vi
    .fn()
    .mockResolvedValue({ data: { createEvent: { id: "event-3" } } }),
  updateEvent = vi.fn().mockResolvedValue({ data: { updateEvent: {} } }),
  attachParticipant = vi
    .fn()
    .mockResolvedValue({ data: { attachParticipant: {} } }),
  detachParticipant = vi
    .fn()
    .mockResolvedValue({ data: { detachParticipant: {} } }),
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === EntitiesDocument) {
      return [{ data: { entities }, fetching: false, stale: false }, vi.fn()];
    }
    if (args.query === SessionsDocument) {
      return [{ data: { sessions }, fetching: false, stale: false }, vi.fn()];
    }

    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === CreateEventDocument) {
      return [{ fetching: false, error: undefined, stale: false }, createEvent];
    }
    if (document === UpdateEventDocument) {
      return [{ fetching: false, error: undefined, stale: false }, updateEvent];
    }
    if (document === AttachParticipantDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        attachParticipant,
      ];
    }
    if (document === DetachParticipantDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        detachParticipant,
      ];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return { createEvent, updateEvent, attachParticipant, detachParticipant };
}

function renderCreate(onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <EventFormWindow
      campaignId="camp-1"
      mode={{ mode: "create" }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

function renderEdit(event: EventRow, onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <EventFormWindow
      campaignId="camp-1"
      mode={{ mode: "edit", item: event }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

describe("EventFormWindow", () => {
  it("creates an event with selected participants and calls onSaved/onClose", async () => {
    const { createEvent, attachParticipant } = setupMocks();
    const user = userEvent.setup();
    const { onSaved, onClose } = renderCreate();

    await user.type(screen.getByLabelText("Title"), "New event");
    await user.type(screen.getByLabelText("Order (in-fiction)"), "Day 3");
    await user.click(screen.getByRole("checkbox", { name: "Theo Vance" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createEvent).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        title: "New event",
        description: null,
        occurredAt: "Day 3",
        sessionId: null,
      },
    });
    expect(attachParticipant).toHaveBeenCalledWith({
      eventId: "event-3",
      entityId: "npc-1",
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("seeds the edit form with the event's fields and participants", async () => {
    const event: EventRow = {
      id: "event-1",
      title: "Coterie forms an uneasy alliance",
      description: "They agreed to a truce.",
      occurredAt: "Day 1",
      sessionId: "sess-1",
      session: { id: "sess-1", sessionNumber: 11 },
      participants: [{ id: "npc-1", name: "Theo Vance" }],
    };
    const { updateEvent, attachParticipant, detachParticipant } = setupMocks();
    const user = userEvent.setup();
    renderEdit(event);

    expect(screen.getByLabelText("Title")).toHaveValue(
      "Coterie forms an uneasy alliance",
    );
    expect(screen.getByLabelText("Order (in-fiction)")).toHaveValue("Day 1");
    expect(screen.getByLabelText("Logged in session")).toHaveValue("sess-1");
    expect(screen.getByRole("checkbox", { name: "Theo Vance" })).toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "Sister Agnes" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateEvent).toHaveBeenCalledWith({
      input: {
        id: "event-1",
        title: "Coterie forms an uneasy alliance",
        description: "They agreed to a truce.",
        occurredAt: "Day 1",
        sessionId: "sess-1",
      },
    });
    expect(attachParticipant).toHaveBeenCalledWith({
      eventId: "event-1",
      entityId: "npc-2",
    });
    expect(detachParticipant).not.toHaveBeenCalled();
  });

  it("calls onClose without saving when Cancel is clicked", async () => {
    const { createEvent } = setupMocks();
    const user = userEvent.setup();
    const { onClose, onSaved } = renderCreate();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(createEvent).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
