import { useEffect, useState } from "react";

import { prefersDarkTheme } from "../lib/colorScheme";

export type ColorScheme = "light" | "dark";

function readColorScheme(): ColorScheme {
  return prefersDarkTheme() ? "dark" : "light";
}

// Reactive counterpart to prefersDarkTheme(): consumers that render
// differently per theme — like MapCanvas, which has no CSS equivalent of
// var(--surface) for picking a tile source — need to know when the OS
// preference or an explicit [data-theme] attribute *changes*, not just its
// value at mount.
export function useColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(readColorScheme);

  useEffect(() => {
    const update = () => setScheme(readColorScheme());

    // jsdom (unlike every real browser) has no matchMedia — prefersDarkTheme
    // already guards its one-shot read of it, so the subscription has to
    // guard itself too rather than assume the call above didn't throw.
    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    media?.addEventListener("change", update);

    // No theme toggle sets [data-theme] yet, but tokens.css is already ready
    // for one — this observer means the map picks it up the moment one exists.
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      media?.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  return scheme;
}
