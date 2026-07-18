import { useEffect, useRef } from "react";
import type { KeyboardEvent, RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
}

// Recovers the keyboard/focus behavior a native <dialog> (and therefore
// Modal) gets for free but a plain positioned div doesn't (KAN-111):
// - focus moves into the window on mount, preferring its body content over
//   title-bar chrome (Refresh/Close) so e.g. an add/edit window's first
//   field gets focus, not the Close button;
// - Tab/Shift+Tab cycles within the window instead of escaping to whatever
//   window happens to be behind it;
// - Escape closes it;
// - focus returns to whatever had it before the window opened, on close.
//
// Deliberately not a hard modal trap (pointer interaction with other
// windows is untouched) — desktop windows are non-modal by design, several
// can be open at once, so this only governs keyboard focus while this
// window has it.
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
  // Skips the steal-focus-on-mount / restore-on-unmount pair while still
  // keeping Escape/Tab-wrap live — for windows that are simply present as
  // part of the initial layout (nobody "opened" them, so nothing should
  // yank focus away from wherever the page naturally starts) as opposed to
  // ones a user action just opened. Callers decide which is which; see
  // DesktopBoard's autoFocus wiring.
  autoFocus = true,
) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const body = container.querySelector<HTMLElement>("[data-window-body]");
    const bodyFocusable = body ? getFocusableElements(body) : [];
    const initialTarget =
      bodyFocusable[0] ?? getFocusableElements(container)[0] ?? container;
    initialTarget.focus();

    return () => {
      previouslyFocused?.focus?.();
    };
    // Runs once on mount/unmount only — re-focusing on every re-render
    // would steal focus back from wherever the user just clicked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onEscapeRef.current();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
}
