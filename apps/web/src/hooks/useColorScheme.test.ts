import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useColorScheme } from "./useColorScheme";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  vi.unstubAllGlobals();
});

describe("useColorScheme", () => {
  it("reads dark from the OS preference when no explicit theme is set", () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("dark");
  });

  it("defaults to light when the OS has no dark preference", () => {
    mockMatchMedia(false);

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("light");
  });

  it("prefers an explicit [data-theme] over the OS preference", () => {
    mockMatchMedia(true);
    document.documentElement.dataset.theme = "light";

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("light");
  });

  it("updates when [data-theme] changes after mount", async () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("light");

    document.documentElement.dataset.theme = "dark";

    await waitFor(() => expect(result.current).toBe("dark"));
  });
});
