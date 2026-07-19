import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { useDesktopWindowsController } from "./useDesktopWindowsController";
import { useWorkspaceStateSync } from "./useWorkspaceStateSync";
import {
  MyWorkspaceStateDocument,
  SaveWorkspaceStateDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
});

// The two hooks CampaignDesktopPage actually wires together, driven the way
// it wires them — the controller's live object handed straight to the sync
// hook. The per-hook unit tests pass a hand-built target instead, which is
// why a break in the seam between them can hide from both.
function useCampaignDesktop(campaignId: string) {
  const desktopWindows = useDesktopWindowsController(campaignId);
  useWorkspaceStateSync(campaignId, desktopWindows);
  return desktopWindows;
}

function setupUrql({
  myWorkspaceState = null as {
    layout: string;
    recentEntityIds: string;
    updatedAt: string;
  } | null,
} = {}) {
  const saveWorkspaceState = vi.fn().mockResolvedValue({ data: {} });

  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === MyWorkspaceStateDocument) {
      return [
        { data: { myWorkspaceState }, fetching: false, stale: false },
        vi.fn(),
      ];
    }
    throw new Error("Unexpected query in test");
  }) as never);

  vi.mocked(useMutation).mockImplementation(((doc: unknown) => {
    if (doc === SaveWorkspaceStateDocument) {
      return [{ fetching: false, stale: false }, saveWorkspaceState];
    }
    throw new Error("Unexpected mutation in test");
  }) as never);

  return { saveWorkspaceState };
}

function lastSavedPayload(saveWorkspaceState: ReturnType<typeof vi.fn>) {
  const calls = saveWorkspaceState.mock.calls;
  return calls[calls.length - 1]?.[0]?.input as
    { layout: string; recentEntityIds: string } | undefined;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("workspace persistence across a tab reload", () => {
  it("keeps a catalog window open across a reload using localStorage alone", () => {
    setupUrql();

    const first = renderHook(() => useCampaignDesktop("camp-1"));
    // 'timeline' ships hidden; opening it is the change that must survive.
    act(() => {
      first.result.current.toggle("timeline");
    });
    expect(first.result.current.layout.timeline.hidden).toBe(false);
    first.unmount();

    const second = renderHook(() => useCampaignDesktop("camp-1"));

    expect(second.result.current.layout.timeline.hidden).toBe(false);
  });

  it("saves the opened window to the server, and restores it from that save", () => {
    const { saveWorkspaceState } = setupUrql();

    const first = renderHook(() => useCampaignDesktop("camp-1"));
    act(() => {
      first.result.current.toggle("timeline");
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const saved = lastSavedPayload(saveWorkspaceState);
    expect(saved).toBeDefined();
    expect(JSON.parse(saved!.layout).timeline.hidden).toBe(false);
    first.unmount();

    // A different browser/tab: no localStorage, only what the server has.
    localStorage.clear();
    setupUrql({
      myWorkspaceState: {
        layout: saved!.layout,
        recentEntityIds: saved!.recentEntityIds,
        updatedAt: new Date().toISOString(),
      },
    });
    const second = renderHook(() => useCampaignDesktop("camp-1"));

    expect(second.result.current.layout.timeline.hidden).toBe(false);
  });

  it("does not let a stale server snapshot reopen a window closed locally afterwards", () => {
    // Server still holds an old snapshot with timeline open; locally the
    // user has since closed it. The reload must not resurrect it.
    const staleLayout = JSON.stringify({
      timeline: { x: 28, y: 322, width: 480, height: 260, hidden: false, z: 5 },
    });
    setupUrql({
      myWorkspaceState: {
        layout: staleLayout,
        recentEntityIds: "[]",
        // Saved well before anything this browser has done locally.
        updatedAt: new Date(Date.now() - 60_000).toISOString(),
      },
    });

    const first = renderHook(() => useCampaignDesktop("camp-1"));
    act(() => {
      first.result.current.toggle("timeline");
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(first.result.current.layout.timeline.hidden).toBe(true);
    first.unmount();

    const second = renderHook(() => useCampaignDesktop("camp-1"));

    expect(second.result.current.layout.timeline.hidden).toBe(true);
  });
});

describe("the debounce window around a reload", () => {
  it("flushes the pending save when the tab is closed inside the debounce window", () => {
    const { saveWorkspaceState } = setupUrql();

    const first = renderHook(() => useCampaignDesktop("camp-1"));
    act(() => {
      first.result.current.toggle("timeline");
    });
    // The user reloads ~immediately, well inside SAVE_DEBOUNCE_MS.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    first.unmount();

    expect(saveWorkspaceState).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(lastSavedPayload(saveWorkspaceState)!.layout).timeline.hidden,
    ).toBe(false);
  });
});

describe("cross-device sync", () => {
  it("still lets a genuinely newer server snapshot win over local state", () => {
    setupUrql();

    // This browser opened 'timeline' a while ago.
    const first = renderHook(() => useCampaignDesktop("camp-1"));
    act(() => {
      first.result.current.toggle("timeline");
    });
    first.unmount();

    // Meanwhile another device saved a layout with 'timeline' closed and
    // 'maps' open, after this browser's last local write.
    setupUrql({
      myWorkspaceState: {
        layout: JSON.stringify({
          timeline: {
            x: 28,
            y: 322,
            width: 480,
            height: 260,
            hidden: true,
            z: 1,
          },
          maps: { x: 10, y: 10, width: 560, height: 440, hidden: false, z: 9 },
        }),
        recentEntityIds: "[]",
        updatedAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    const second = renderHook(() => useCampaignDesktop("camp-1"));

    expect(second.result.current.layout.timeline.hidden).toBe(true);
    expect(second.result.current.layout.maps.hidden).toBe(false);
  });
});

describe("dynamic window restore", () => {
  const ENTITY_WINDOW = {
    id: "entity:e-1",
    title: "Carlos Mendoza",
    render: () => null,
    x: 140,
    y: 80,
    width: 380,
    height: 420,
  };

  it("brings an entity window back after a reload", () => {
    setupUrql();

    const first = renderHook(() => useCampaignDesktop("camp-1"));
    act(() => {
      first.result.current.openWindow(ENTITY_WINDOW);
    });
    first.unmount();

    const second = renderHook(() => useCampaignDesktop("camp-1"));

    expect(second.result.current.dynamicWindows["entity:e-1"]).toBeDefined();
    expect(second.result.current.dynamicWindows["entity:e-1"].title).toBe(
      "Carlos Mendoza",
    );
    // Geometry comes from the layout, which already persisted.
    expect(second.result.current.layout["entity:e-1"]).toMatchObject({
      x: 140,
      y: 80,
      hidden: false,
    });
  });

  it("restores a note window too", () => {
    setupUrql();

    const first = renderHook(() => useCampaignDesktop("camp-1"));
    act(() => {
      first.result.current.openWindow({
        id: "note:note-1",
        title: "Session 1 recap",
        render: () => null,
        x: 180,
        y: 88,
        width: 460,
        height: 520,
      });
    });
    first.unmount();

    const second = renderHook(() => useCampaignDesktop("camp-1"));

    expect(second.result.current.dynamicWindows["note:note-1"].title).toBe(
      "Session 1 recap",
    );
  });

  it("does not restore a window the user closed before reloading", () => {
    setupUrql();

    const first = renderHook(() => useCampaignDesktop("camp-1"));
    act(() => {
      first.result.current.openWindow(ENTITY_WINDOW);
    });
    act(() => {
      first.result.current.closeWindow("entity:e-1");
    });
    first.unmount();

    const second = renderHook(() => useCampaignDesktop("camp-1"));

    expect(second.result.current.dynamicWindows["entity:e-1"]).toBeUndefined();
    expect(second.result.current.layout["entity:e-1"]).toBeUndefined();
  });

  it("does not restore a form window, and prunes its orphaned layout entry", () => {
    setupUrql();

    const first = renderHook(() => useCampaignDesktop("camp-1"));
    act(() => {
      first.result.current.openWindow({
        id: "note-form:note-1",
        title: "Edit: Session 1 recap",
        render: () => null,
        x: 160,
        y: 96,
        width: 420,
        height: 520,
      });
    });
    expect(first.result.current.layout["note-form:note-1"]).toBeDefined();
    first.unmount();

    const second = renderHook(() => useCampaignDesktop("camp-1"));

    // An unsaved draft can't be rebuilt from an id, so it stays closed —
    // and leaves nothing behind in the layout.
    expect(
      second.result.current.dynamicWindows["note-form:note-1"],
    ).toBeUndefined();
    expect(second.result.current.layout["note-form:note-1"]).toBeUndefined();
  });

  it("keeps each campaign's restored windows separate", () => {
    setupUrql();

    const first = renderHook(() => useCampaignDesktop("camp-1"));
    act(() => {
      first.result.current.openWindow(ENTITY_WINDOW);
    });
    first.unmount();

    const other = renderHook(() => useCampaignDesktop("camp-2"));

    expect(other.result.current.dynamicWindows["entity:e-1"]).toBeUndefined();
  });
});
