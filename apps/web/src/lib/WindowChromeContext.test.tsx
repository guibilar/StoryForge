import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  WindowChromeContext,
  useWindowChrome,
  useWindowChromeSync,
} from "./WindowChromeContext";
import type { WindowChromeApi } from "./WindowChromeContext";

describe("useWindowChrome", () => {
  it("returns no-op setters when there is no provider", () => {
    const { result } = renderHook(() => useWindowChrome());

    expect(() => result.current.setLoading(true)).not.toThrow();
    expect(() => result.current.setOnRefresh(() => {})).not.toThrow();
  });

  it("returns the provided api when a provider is present", () => {
    const api: WindowChromeApi = {
      setLoading: vi.fn(),
      setOnRefresh: vi.fn(),
    };
    const { result } = renderHook(() => useWindowChrome(), {
      wrapper: ({ children }) => (
        <WindowChromeContext.Provider value={api}>
          {children}
        </WindowChromeContext.Provider>
      ),
    });

    expect(result.current).toBe(api);
  });
});

describe("useWindowChromeSync", () => {
  function renderWithApi(isLoading: boolean, onRefresh?: () => void) {
    const setLoading = vi.fn();
    const setOnRefresh = vi.fn();
    const api: WindowChromeApi = { setLoading, setOnRefresh };
    const utils = renderHook(
      ({ isLoading, onRefresh }) => useWindowChromeSync(isLoading, onRefresh),
      {
        initialProps: { isLoading, onRefresh },
        wrapper: ({ children }) => (
          <WindowChromeContext.Provider value={api}>
            {children}
          </WindowChromeContext.Provider>
        ),
      },
    );
    return { ...utils, setLoading, setOnRefresh };
  }

  it("reports the initial loading state", () => {
    const { setLoading } = renderWithApi(true);

    expect(setLoading).toHaveBeenCalledWith(true);
  });

  it("re-reports loading state when it changes", () => {
    const onRefresh = vi.fn();
    const { rerender, setLoading } = renderWithApi(false, onRefresh);

    expect(setLoading).toHaveBeenLastCalledWith(false);

    rerender({ isLoading: true, onRefresh });

    expect(setLoading).toHaveBeenLastCalledWith(true);
  });

  it("registers the refresh callback, and clears it on unmount", () => {
    const onRefresh = vi.fn();
    const { unmount, setOnRefresh } = renderWithApi(false, onRefresh);

    expect(setOnRefresh).toHaveBeenCalledTimes(1);
    // setOnRefresh is called with an updater function (to avoid React's
    // "function as lazy state initializer" ambiguity) — invoke it to get
    // the actual callback that was registered.
    const registered = setOnRefresh.mock.calls[0][0]() as
      (() => void) | undefined;
    expect(registered).toBe(onRefresh);

    unmount();

    expect(setOnRefresh).toHaveBeenLastCalledWith(undefined);
  });

  it("resets loading to false on unmount, even if it was still true", () => {
    const { unmount, setLoading } = renderWithApi(true);

    expect(setLoading).toHaveBeenLastCalledWith(true);

    unmount();

    expect(setLoading).toHaveBeenLastCalledWith(false);
  });
});
