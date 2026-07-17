import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "urql";

import { useWorkspaceStateSync } from "./useWorkspaceStateSync";
import {
  MyWorkspaceStateDocument,
  SaveWorkspaceStateDocument,
} from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
});

function setupUrql({
  myWorkspaceState = null as { layout: string; recentEntityIds: string } | null,
  fetching = false,
  error = undefined as unknown,
} = {}) {
  const saveWorkspaceState = vi.fn().mockResolvedValue({ data: {} });

  vi.mocked(useQuery).mockImplementation(((args: { query: unknown }) => {
    if (args.query === MyWorkspaceStateDocument) {
      return [
        { data: { myWorkspaceState }, fetching, error, stale: false },
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

function makeTarget(
  overrides: Partial<Parameters<typeof useWorkspaceStateSync>[1]> = {},
) {
  return {
    layout: { npcs: { x: 1, y: 2, width: 3, height: 4, hidden: false, z: 1 } },
    recentIds: ["e-1"],
    hydrateFromServer: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useWorkspaceStateSync", () => {
  it("hydrates from a saved server state on load", () => {
    setupUrql({
      myWorkspaceState: {
        layout: JSON.stringify({
          npcs: { x: 9, y: 9, width: 9, height: 9, hidden: false, z: 1 },
        }),
        recentEntityIds: JSON.stringify(["server-1"]),
      },
    });
    const target = makeTarget();

    renderHook(() => useWorkspaceStateSync("camp-1", target));

    expect(target.hydrateFromServer).toHaveBeenCalledWith(
      { npcs: { x: 9, y: 9, width: 9, height: 9, hidden: false, z: 1 } },
      ["server-1"],
    );
  });

  it("does not hydrate when the user has never saved a workspace state", () => {
    setupUrql({ myWorkspaceState: null });
    const target = makeTarget();

    renderHook(() => useWorkspaceStateSync("camp-1", target));

    expect(target.hydrateFromServer).not.toHaveBeenCalled();
  });

  it("does not hydrate while the query is still fetching", () => {
    setupUrql({ fetching: true, myWorkspaceState: null });
    const target = makeTarget();

    renderHook(() => useWorkspaceStateSync("camp-1", target));

    expect(target.hydrateFromServer).not.toHaveBeenCalled();
  });

  it("fails open on a query error — no hydration, no throw", () => {
    setupUrql({ error: new Error("network down") });
    const target = makeTarget();

    expect(() =>
      renderHook(() => useWorkspaceStateSync("camp-1", target)),
    ).not.toThrow();
    expect(target.hydrateFromServer).not.toHaveBeenCalled();
  });

  it("fails open on a malformed server payload — no hydration, no throw", () => {
    setupUrql({
      myWorkspaceState: { layout: "{not json", recentEntityIds: "[]" },
    });
    const target = makeTarget();

    expect(() =>
      renderHook(() => useWorkspaceStateSync("camp-1", target)),
    ).not.toThrow();
    expect(target.hydrateFromServer).not.toHaveBeenCalled();
  });

  it("debounce-saves local changes back to the server after load has settled", () => {
    const { saveWorkspaceState } = setupUrql({ myWorkspaceState: null });
    const target = makeTarget();

    const { rerender } = renderHook(
      ({ t }) => useWorkspaceStateSync("camp-1", t),
      { initialProps: { t: target } },
    );

    expect(saveWorkspaceState).not.toHaveBeenCalled();

    const changed = makeTarget({
      layout: {
        npcs: { x: 50, y: 60, width: 3, height: 4, hidden: false, z: 1 },
      },
    });
    rerender({ t: changed });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(saveWorkspaceState).toHaveBeenCalledWith({
      input: {
        campaignId: "camp-1",
        layout: JSON.stringify(changed.layout),
        recentEntityIds: JSON.stringify(changed.recentIds),
      },
    });
  });

  it("does not save before the initial load has settled", () => {
    const { saveWorkspaceState } = setupUrql({
      fetching: true,
      myWorkspaceState: null,
    });
    const target = makeTarget();

    renderHook(() => useWorkspaceStateSync("camp-1", target));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(saveWorkspaceState).not.toHaveBeenCalled();
  });

  it("debounces rapid successive changes into a single save", () => {
    const { saveWorkspaceState } = setupUrql({ myWorkspaceState: null });
    const target = makeTarget();

    const { rerender } = renderHook(
      ({ t }) => useWorkspaceStateSync("camp-1", t),
      { initialProps: { t: target } },
    );

    for (let i = 0; i < 5; i += 1) {
      rerender({
        t: makeTarget({
          layout: {
            npcs: { x: i, y: i, width: 3, height: 4, hidden: false, z: 1 },
          },
        }),
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }

    expect(saveWorkspaceState).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(saveWorkspaceState).toHaveBeenCalledTimes(1);
  });

  it("does not query at all when campaignId is empty", () => {
    const queryMock = vi
      .fn()
      .mockReturnValue([
        { data: undefined, fetching: false, stale: false },
        vi.fn(),
      ]);
    vi.mocked(useQuery).mockImplementation(queryMock as never);
    vi.mocked(useMutation).mockImplementation((() => [
      { fetching: false, stale: false },
      vi.fn(),
    ]) as never);
    const target = makeTarget();

    renderHook(() => useWorkspaceStateSync("", target));

    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({ pause: true }),
    );
  });
});
