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

    expect(result.current.layout.npcs).toBeDefined();
    expect(typeof result.current.toggle).toBe("function");
    expect(typeof result.current.reset).toBe("function");
  });
});
