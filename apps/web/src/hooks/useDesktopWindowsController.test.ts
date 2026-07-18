import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useDesktopWindowsController } from "./useDesktopWindowsController";

beforeEach(() => {
  localStorage.clear();
});

describe("useDesktopWindowsController", () => {
  it("registers a dynamic window's title/content alongside its layout position", () => {
    const { result } = renderHook(() => useDesktopWindowsController("camp-1"));

    act(() =>
      result.current.openWindow({
        id: "entity:1",
        title: "Carlos Mendoza",
        render: () => "content",
        x: 10,
        y: 20,
        width: 300,
        height: 200,
      }),
    );

    expect(result.current.dynamicWindows["entity:1"]).toMatchObject({
      title: "Carlos Mendoza",
    });
    expect(result.current.layout["entity:1"]).toMatchObject({
      x: 10,
      y: 20,
    });
  });

  it("closeWindow removes both the dynamic registration and the layout entry", () => {
    const { result } = renderHook(() => useDesktopWindowsController("camp-1"));

    act(() =>
      result.current.openWindow({
        id: "entity:1",
        title: "Carlos Mendoza",
        render: () => "content",
        x: 10,
        y: 20,
        width: 300,
        height: 200,
      }),
    );
    act(() => result.current.closeWindow("entity:1"));

    expect(result.current.dynamicWindows["entity:1"]).toBeUndefined();
    expect(result.current.layout["entity:1"]).toBeUndefined();
  });

  it("exposes the static catalog windows from useDesktopLayout unchanged", () => {
    const { result } = renderHook(() => useDesktopWindowsController("camp-1"));

    expect(result.current.layout.sessions).toBeDefined();
    expect(typeof result.current.toggle).toBe("function");
    expect(typeof result.current.reset).toBe("function");
  });

  it("hydrateFromServer overwrites both layout and recentIds in one call", () => {
    const { result } = renderHook(() => useDesktopWindowsController("camp-1"));

    // Populate a "stale" recentIds entry through the real code path
    // (openWindow), so hydrateFromServer has something to overwrite.
    act(() =>
      result.current.openWindow({
        id: "entity:stale",
        title: "Stale",
        render: () => "content",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      }),
    );
    expect(result.current.recentIds).toEqual(["stale"]);

    act(() =>
      result.current.hydrateFromServer(
        { sessions: { x: 1, y: 2, width: 3, height: 4, hidden: false, z: 5 } },
        ["server-entity"],
      ),
    );

    expect(result.current.layout.sessions).toMatchObject({ x: 1, y: 2 });
    expect(result.current.recentIds).toEqual(["server-entity"]);
  });
});
