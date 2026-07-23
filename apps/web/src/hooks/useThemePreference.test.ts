import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyStoredTheme,
  readStoredTheme,
  useThemePreference,
} from "./useThemePreference";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("useThemePreference", () => {
  it("starts on auto, with no [data-theme] to override the OS", () => {
    const { result } = renderHook(() => useThemePreference());

    expect(result.current.mode).toBe("auto");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("cycles auto → light → dark → auto", () => {
    const { result } = renderHook(() => useThemePreference());

    act(() => result.current.cycle());
    expect(result.current.mode).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    act(() => result.current.cycle());
    expect(result.current.mode).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => result.current.cycle());
    expect(result.current.mode).toBe("auto");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("remembers the choice across a reload", () => {
    const { result, unmount } = renderHook(() => useThemePreference());
    act(() => result.current.setMode("dark"));
    unmount();
    delete document.documentElement.dataset.theme;

    applyStoredTheme();

    expect(readStoredTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("falls back to auto when the stored value is junk", () => {
    localStorage.setItem("storyforge:theme", "neon");

    expect(readStoredTheme()).toBe("auto");
  });
});
