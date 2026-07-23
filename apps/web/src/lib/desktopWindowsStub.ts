import type { DesktopWindowsApi } from "./DesktopWindowsContext";

const noop = () => {};

// Every component test that mounts something reading useDesktopWindows needs
// a full DesktopWindowsApi, and hand-writing all of it per test file meant
// each new window action broke a dozen unrelated suites at once. Tests pass
// in only the members they actually assert on.
export function createDesktopWindowsStub(
  overrides: Partial<DesktopWindowsApi> = {},
): DesktopWindowsApi {
  return {
    layout: {},
    bringToFront: noop,
    toggle: noop,
    minimize: noop,
    restoreWindow: noop,
    toggleMaximize: noop,
    snapWindow: noop,
    arrange: noop,
    showDesktop: noop,
    startDrag: noop,
    startResize: noop,
    reset: noop,
    dynamicWindows: {},
    openWindow: noop,
    closeWindow: noop,
    recentIds: [],
    presets: {},
    savePreset: noop,
    applyPreset: noop,
    hydrateFromServer: noop,
    ...overrides,
  };
}
