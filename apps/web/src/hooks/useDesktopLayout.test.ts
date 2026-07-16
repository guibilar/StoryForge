import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useDesktopLayout } from "./useDesktopLayout";
import type { LayoutMap } from "./useDesktopLayout";

const DEFAULTS: LayoutMap = {
  npcs: { x: 28, y: 24, width: 310, height: 280, hidden: false, z: 2 },
  notes: { x: 526, y: 362, width: 360, height: 240, hidden: true, z: 1 },
};

beforeEach(() => {
  localStorage.clear();
});

describe("useDesktopLayout", () => {
  it("starts from the provided defaults when nothing is stored", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    expect(result.current.layout).toEqual(DEFAULTS);
  });

  it("toggle flips hidden and brings a newly-opened window to front", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.toggle("notes"));

    expect(result.current.layout.notes.hidden).toBe(false);
    expect(result.current.layout.notes.z).toBeGreaterThan(DEFAULTS.npcs.z);
  });

  it("toggle hides an open window without changing its z", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.toggle("npcs"));

    expect(result.current.layout.npcs.hidden).toBe(true);
    expect(result.current.layout.npcs.z).toBe(DEFAULTS.npcs.z);
  });

  it("bringToFront raises z above every other window", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.bringToFront("notes"));

    expect(result.current.layout.notes.z).toBeGreaterThan(
      result.current.layout.npcs.z,
    );
  });

  it("move updates position without persisting until something else does", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.move("npcs", 200, 150));

    expect(result.current.layout.npcs).toMatchObject({ x: 200, y: 150 });
    expect(localStorage.getItem("storyforge:desktop:camp-1")).toBeNull();
  });

  it("resize updates size without persisting until something else does", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));

    act(() => result.current.resize("npcs", 400, 300));

    expect(result.current.layout.npcs).toMatchObject({
      width: 400,
      height: 300,
    });
    expect(localStorage.getItem("storyforge:desktop:camp-1")).toBeNull();
  });

  it("persists toggle to localStorage, readable by a fresh hook instance", () => {
    const { result, unmount } = renderHook(() =>
      useDesktopLayout("camp-1", DEFAULTS),
    );
    act(() => result.current.toggle("notes"));
    unmount();

    const { result: fresh } = renderHook(() =>
      useDesktopLayout("camp-1", DEFAULTS),
    );
    expect(fresh.current.layout.notes.hidden).toBe(false);
  });

  it("reset clears storage and restores defaults", () => {
    const { result } = renderHook(() => useDesktopLayout("camp-1", DEFAULTS));
    act(() => result.current.toggle("notes"));
    act(() => result.current.reset());

    expect(result.current.layout).toEqual(DEFAULTS);
    expect(localStorage.getItem("storyforge:desktop:camp-1")).toBeNull();
  });

  it("scopes storage per campaign id", () => {
    const { result: campaignA } = renderHook(() =>
      useDesktopLayout("camp-a", DEFAULTS),
    );
    act(() => campaignA.current.toggle("notes"));

    const { result: campaignB } = renderHook(() =>
      useDesktopLayout("camp-b", DEFAULTS),
    );
    expect(campaignB.current.layout.notes.hidden).toBe(true);
  });
});
