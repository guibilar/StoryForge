// Mirrors the cascade in tokens.css: an explicit [data-theme] wins over the
// OS `prefers-color-scheme`, which is only consulted as its fallback.
export function prefersDarkTheme(): boolean {
  if (typeof document !== "undefined") {
    const explicit = document.documentElement.dataset.theme;
    if (explicit === "dark") {
      return true;
    }
    if (explicit === "light") {
      return false;
    }
  }
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}
