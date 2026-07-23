import { useCallback, useState } from "react";

// tokens.css defines three states: no [data-theme] attribute means "follow
// the OS", and an explicit light/dark wins over it. This hook is the only
// thing that writes that attribute — colorScheme.ts and useColorScheme
// already read it, so canvas-drawn surfaces (MapCanvas's tile source, the
// desktop wallpaper) follow a switch without knowing this hook exists.
export type ThemeMode = "auto" | "light" | "dark";

const STORAGE_KEY = "storyforge:theme";
const CYCLE: ThemeMode[] = ["auto", "light", "dark"];

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}

export function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeMode(stored) ? stored : "auto";
  } catch {
    // Storage blocked (private mode, embedded context) — following the OS is
    // a fine answer, and one that needs no storage at all.
    return "auto";
  }
}

function applyTheme(mode: ThemeMode): void {
  if (mode === "auto") {
    delete document.documentElement.dataset.theme;
    return;
  }
  document.documentElement.dataset.theme = mode;
}

// Called once from main.tsx before the first render: applying the stored
// choice from inside a component would let one frame paint in the OS theme
// first, which reads as a flash on every page load.
export function applyStoredTheme(): void {
  applyTheme(readStoredTheme());
}

export function useThemePreference() {
  const [mode, setModeState] = useState<ThemeMode>(readStoredTheme);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The theme still applies for this session; it just won't be
      // remembered for the next one.
    }
  }, []);

  const cycle = useCallback(() => {
    setModeState((current) => {
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // See setMode.
      }
      return next;
    });
  }, []);

  return { mode, setMode, cycle };
}
