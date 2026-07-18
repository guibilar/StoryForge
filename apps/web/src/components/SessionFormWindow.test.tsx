import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { SessionFormWindow } from "./SessionFormWindow";
import type { SessionRow } from "./SessionFormWindow";
import { WindowChromeContext } from "../lib/WindowChromeContext";
import {
  AttachSessionAttendeeDocument,
  CampaignDocument,
  CreateSessionDocument,
  DetachSessionAttendeeDocument,
  UpdateSessionDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useMutation: vi.fn(), useQuery: vi.fn() };
});

const CURRENT_USER_ID = "user-1";
const OTHER_USER_ID = "user-2";

const members = [
  {
    userId: CURRENT_USER_ID,
    role: "OWNER",
    user: { id: CURRENT_USER_ID, email: "owner@example.com" },
  },
  {
    userId: OTHER_USER_ID,
    role: "PLAYER",
    user: { id: OTHER_USER_ID, email: "player@example.com" },
  },
];

function setupMocks({
  createSession = vi
    .fn()
    .mockResolvedValue({ data: { createSession: { id: "sess-3" } } }),
  updateSession = vi.fn().mockResolvedValue({ data: { updateSession: {} } }),
  attachSessionAttendee = vi
    .fn()
    .mockResolvedValue({ data: { attachSessionAttendee: {} } }),
  detachSessionAttendee = vi
    .fn()
    .mockResolvedValue({ data: { detachSessionAttendee: {} } }),
  createFetching = false,
} = {}) {
  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
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

    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((document: unknown) => {
    if (document === CreateSessionDocument) {
      return [
        { fetching: createFetching, error: undefined, stale: false },
        createSession,
      ];
    }
    if (document === UpdateSessionDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        updateSession,
      ];
    }
    if (document === AttachSessionAttendeeDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        attachSessionAttendee,
      ];
    }
    if (document === DetachSessionAttendeeDocument) {
      return [
        { fetching: false, error: undefined, stale: false },
        detachSessionAttendee,
      ];
    }

    throw new Error("Unexpected mutation in test");
  }) as never);

  return {
    createSession,
    updateSession,
    attachSessionAttendee,
    detachSessionAttendee,
  };
}

function renderCreate(onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <SessionFormWindow
      campaignId="camp-1"
      mode={{ mode: "create" }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

function renderEdit(session: SessionRow, onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <SessionFormWindow
      campaignId="camp-1"
      mode={{ mode: "edit", item: session }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

describe("SessionFormWindow", () => {
  it("creates a session with selected attendees and calls onSaved/onClose", async () => {
    const { createSession, attachSessionAttendee } = setupMocks();
    const user = userEvent.setup();
    const { onSaved, onClose } = renderCreate();

    await user.type(screen.getByLabelText("Date"), "2026-07-01");
    await user.click(
      screen.getByRole("checkbox", { name: "owner@example.com" }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createSession).toHaveBeenCalledWith({
      input: { campaignId: "camp-1", date: "2026-07-01", summary: null },
    });
    expect(attachSessionAttendee).toHaveBeenCalledWith({
      sessionId: "sess-3",
      userId: CURRENT_USER_ID,
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("seeds the edit form with the session's date, recap, and attendees", async () => {
    const session: SessionRow = {
      id: "sess-1",
      sessionNumber: 1,
      date: "2026-06-01T00:00:00.000Z",
      summary: "The party arrived in town.",
      attendees: [
        {
          userId: CURRENT_USER_ID,
          user: { id: CURRENT_USER_ID, email: "owner@example.com" },
        },
      ],
    };
    const { updateSession, attachSessionAttendee, detachSessionAttendee } =
      setupMocks();
    const user = userEvent.setup();
    renderEdit(session);

    expect(screen.getByLabelText("Date")).toHaveValue("2026-06-01");
    expect(screen.getByLabelText("Recap")).toHaveValue(
      "The party arrived in town.",
    );
    expect(
      screen.getByRole("checkbox", { name: "owner@example.com" }),
    ).toBeChecked();

    await user.click(
      screen.getByRole("checkbox", { name: "player@example.com" }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateSession).toHaveBeenCalledWith({
      input: {
        id: "sess-1",
        date: "2026-06-01",
        summary: "The party arrived in town.",
      },
    });
    expect(attachSessionAttendee).toHaveBeenCalledWith({
      sessionId: "sess-1",
      userId: OTHER_USER_ID,
    });
    expect(detachSessionAttendee).not.toHaveBeenCalled();
  });

  it("calls onClose without saving when Cancel is clicked", async () => {
    const { createSession } = setupMocks();
    const user = userEvent.setup();
    const { onClose, onSaved } = renderCreate();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(createSession).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports loading to the window chrome while a save is in flight", () => {
    setupMocks({ createFetching: true });
    const chromeApi = { setLoading: vi.fn(), setOnRefresh: vi.fn() };
    render(
      <WindowChromeContext.Provider value={chromeApi}>
        <SessionFormWindow
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
