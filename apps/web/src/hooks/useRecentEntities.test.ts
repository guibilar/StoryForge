import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useRecentEntities } from "./useRecentEntities";

beforeEach(() => {
  localStorage.clear();
});

describe("useRecentEntities", () => {
  it("starts empty when nothing is stored", () => {
    const { result } = renderHook(() => useRecentEntities("camp-1"));

    expect(result.current.recentIds).toEqual([]);
  });

  it("records an opened id at the front", () => {
    const { result } = renderHook(() => useRecentEntities("camp-1"));

    act(() => result.current.recordOpen("e-1"));
    act(() => result.current.recordOpen("e-2"));

    expect(result.current.recentIds).toEqual(["e-2", "e-1"]);
  });

  it("moves an already-recorded id to the front instead of duplicating it", () => {
    const { result } = renderHook(() => useRecentEntities("camp-1"));

    act(() => result.current.recordOpen("e-1"));
    act(() => result.current.recordOpen("e-2"));
    act(() => result.current.recordOpen("e-1"));

    expect(result.current.recentIds).toEqual(["e-1", "e-2"]);
  });

  it("caps the list at 10 entries", () => {
    const { result } = renderHook(() => useRecentEntities("camp-1"));

    act(() => {
      for (let i = 0; i < 12; i += 1) {
        result.current.recordOpen(`e-${i}`);
      }
    });

    expect(result.current.recentIds).toHaveLength(10);
    expect(result.current.recentIds[0]).toBe("e-11");
  });

  it("persists to localStorage, readable by a fresh hook instance", () => {
    const { result, unmount } = renderHook(() => useRecentEntities("camp-1"));
    act(() => result.current.recordOpen("e-1"));
    unmount();

    const { result: fresh } = renderHook(() => useRecentEntities("camp-1"));
    expect(fresh.current.recentIds).toEqual(["e-1"]);
  });

  it("hydrateRecents overwrites the list wholesale and persists it", () => {
    const { result } = renderHook(() => useRecentEntities("camp-1"));

    act(() => result.current.recordOpen("stale"));
    act(() => result.current.hydrateRecents(["server-1", "server-2"]));

    expect(result.current.recentIds).toEqual(["server-1", "server-2"]);
    const stored = JSON.parse(
      localStorage.getItem("storyforge:recents:camp-1")!,
    );
    expect(stored).toEqual(["server-1", "server-2"]);
  });

  it("hydrateRecents caps at 10 entries too", () => {
    const { result } = renderHook(() => useRecentEntities("camp-1"));
    const many = Array.from({ length: 12 }, (_, i) => `e-${i}`);

    act(() => result.current.hydrateRecents(many));

    expect(result.current.recentIds).toHaveLength(10);
  });

  it("scopes storage per campaign id", () => {
    const { result: campaignA } = renderHook(() => useRecentEntities("camp-a"));
    act(() => campaignA.current.recordOpen("e-1"));

    const { result: campaignB } = renderHook(() => useRecentEntities("camp-b"));
    expect(campaignB.current.recentIds).toEqual([]);
  });
});
