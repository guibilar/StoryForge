import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAddEditWindow } from "./useAddEditWindow";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";

vi.mock("../lib/DesktopWindowsContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/DesktopWindowsContext")>();
  return { ...actual, useDesktopWindows: vi.fn() };
});

interface Item {
  id: string;
}

function setupDesktopWindows(dynamicWindows: Record<string, unknown> = {}) {
  const openWindow = vi.fn();
  const closeWindow = vi.fn();
  vi.mocked(useDesktopWindows).mockReturnValue({
    layout: {},
    bringToFront: vi.fn(),
    toggle: vi.fn(),
    startDrag: vi.fn(),
    startResize: vi.fn(),
    reset: vi.fn(),
    dynamicWindows: dynamicWindows as never,
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

describe("useAddEditWindow", () => {
  it("opens a window id ending in :new for create mode", () => {
    const { openWindow } = setupDesktopWindows();
    const { result } = renderHook(() =>
      useAddEditWindow({ idPrefix: "note-form", width: 400, height: 500 }),
    );

    result.current.openAddEditWindow<Item>(
      { mode: "create" },
      "New Note",
      () => null,
    );

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "note-form:new",
        title: "New Note",
        width: 400,
        height: 500,
      }),
    );
  });

  it("gives each keyed create its own window id so one can't replace another", () => {
    const { openWindow } = setupDesktopWindows();
    const { result } = renderHook(() =>
      useAddEditWindow({ idPrefix: "marker-form", width: 400, height: 500 }),
    );

    result.current.openAddEditWindow<Item>(
      { mode: "create", key: "12,34" },
      "New Marker",
      () => null,
    );
    result.current.openAddEditWindow<Item>(
      { mode: "create", key: "56,78" },
      "New Marker",
      () => null,
    );

    expect(openWindow.mock.calls[0][0]).toMatchObject({
      id: "marker-form:new:12,34",
    });
    expect(openWindow.mock.calls[1][0]).toMatchObject({
      id: "marker-form:new:56,78",
    });
  });

  it("opens a window id keyed by the item's id for edit mode", () => {
    const { openWindow } = setupDesktopWindows();
    const { result } = renderHook(() =>
      useAddEditWindow({ idPrefix: "note-form", width: 400, height: 500 }),
    );

    result.current.openAddEditWindow<Item>(
      { mode: "edit", item: { id: "note-1" } },
      "Edit: Note",
      () => null,
    );

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note-form:note-1", title: "Edit: Note" }),
    );
  });

  it("cascades the offset based on the number of open dynamic windows", () => {
    const { openWindow } = setupDesktopWindows({ a: {}, b: {} });
    const { result } = renderHook(() =>
      useAddEditWindow({ idPrefix: "note-form", width: 400, height: 500 }),
    );

    result.current.openAddEditWindow<Item>(
      { mode: "create" },
      "New Note",
      () => null,
    );

    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({ x: 160 + 48, y: 96 + 48 }),
    );
  });

  it("passes a close callback that closes this window's own id", () => {
    const { openWindow, closeWindow } = setupDesktopWindows();
    const { result } = renderHook(() =>
      useAddEditWindow({ idPrefix: "note-form", width: 400, height: 500 }),
    );

    const render = vi.fn().mockReturnValue(null);
    result.current.openAddEditWindow<Item>(
      { mode: "edit", item: { id: "note-1" } },
      "Edit: Note",
      render,
    );

    const request = openWindow.mock.calls[0][0] as { render: () => unknown };
    request.render();
    const close = render.mock.calls[0][0] as () => void;
    close();

    expect(closeWindow).toHaveBeenCalledWith("note-form:note-1");
  });
});
