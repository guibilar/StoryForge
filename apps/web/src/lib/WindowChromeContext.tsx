import { createContext, useContext, useEffect } from "react";

export interface WindowChromeApi {
  setLoading: (loading: boolean) => void;
  setOnRefresh: (onRefresh: (() => void) | undefined) => void;
}

// DesktopBoard owns the actual <Window> chrome (title bar, loading overlay,
// refresh button — KAN-106) for both catalog and dynamic windows; the
// content mounted inside it owns the query/mutation state those affordances
// need. This is the channel content reports up through, via
// useWindowChromeSync below, instead of DesktopBoard needing to know what's
// inside every window it renders.
export const WindowChromeContext = createContext<WindowChromeApi | null>(null);

// No-op outside a chrome-providing window (e.g. MobileDesktop's panel view,
// which renders catalog content directly without a <Window> wrapper, or a
// component under test in isolation) — content doesn't need to special-case
// whether it's actually inside a window right now.
const NOOP_CHROME: WindowChromeApi = {
  setLoading: () => {},
  setOnRefresh: () => {},
};

export function useWindowChrome(): WindowChromeApi {
  return useContext(WindowChromeContext) ?? NOOP_CHROME;
}

// Convenience for the common case: report a query's fetching state and an
// optional network-only refetch callback to the enclosing window's chrome
// in one call, instead of wiring setLoading/setOnRefresh separately.
export function useWindowChromeSync(
  isLoading: boolean,
  onRefresh?: () => void,
) {
  const { setLoading, setOnRefresh } = useWindowChrome();

  useEffect(() => {
    setLoading(isLoading);
    // Reset to not-loading on unmount — e.g. a tabbed window (EntityWindow)
    // switching away from the tab reporting isLoading shouldn't leave the
    // chrome stuck showing the overlay for content that's no longer there.
    return () => setLoading(false);
  }, [isLoading, setLoading]);

  useEffect(() => {
    setOnRefresh(() => onRefresh);
    return () => setOnRefresh(undefined);
  }, [onRefresh, setOnRefresh]);
}
