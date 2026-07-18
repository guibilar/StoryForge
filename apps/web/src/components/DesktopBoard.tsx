import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@storyforge/ui";

import { visibleWindowCatalog } from "../lib/windowCatalog";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import type { CampaignRole } from "../gql/graphql";
import { WindowChromeHost } from "./WindowChromeHost";
import styles from "./DesktopBoard.module.css";

export interface DesktopBoardProps {
  role?: CampaignRole;
}

const APPLY_ANIMATION_MS = 320;

// Renders the shared desktop-windows state (owned by CampaignDesktopPage via
// useDesktopWindowsController, reached here through DesktopWindowsContext —
// see that file for why this isn't local state anymore).
export function DesktopBoard({ role }: DesktopBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const {
    layout,
    bringToFront,
    toggle,
    startDrag,
    startResize,
    reset,
    dynamicWindows,
    closeWindow,
    presets,
    savePreset,
    applyPreset,
  } = useDesktopWindows();
  const catalog = visibleWindowCatalog(role);

  // False only during this DesktopBoard instance's very first render.
  // Windows that are already visible then are just part of the
  // initial/persisted layout for this campaign — nobody "opened" them, so
  // they shouldn't steal keyboard focus from wherever the page naturally
  // starts. A window that mounts on any later render (a toggle, a fresh
  // dynamic openWindow call) genuinely was just opened by a user action, so
  // it should get Window's autoFocus behavior — see useFocusTrap.
  // Deliberately not reset by reset()/applyPreset(): those reposition
  // windows that already exist, not open new ones. Scoped to this
  // component instance (not module state) so navigating to a different
  // campaign's desktop gets its own honest "first render" again.
  const [hasRenderedOnce, setHasRenderedOnce] = useState(false);
  useEffect(() => {
    // One-shot mount-boundary flag, not state derived from props/other
    // state — the pattern react-hooks/set-state-in-effect warns against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasRenderedOnce(true);
  }, []);

  // Only applied to window chrome briefly after applying a preset — a
  // permanent CSS transition on left/top/width/height would fight the
  // per-pointermove style updates during drag/resize, making them feel
  // laggy instead of instant.
  const [animating, setAnimating] = useState(false);
  const [presetSelection, setPresetSelection] = useState("");
  const presetNames = Object.keys(presets);

  function handleApplyPreset(name: string) {
    applyPreset(name);
    setAnimating(true);
    setTimeout(() => setAnimating(false), APPLY_ANIMATION_MS);
  }

  function handleSavePreset() {
    const name = window.prompt("Name this layout:")?.trim();
    if (name) {
      savePreset(name);
    }
  }

  function renderWindow(
    id: string,
    title: string,
    content: ReactNode,
    onClose: () => void,
  ) {
    const windowLayout = layout[id];
    if (!windowLayout || windowLayout.hidden) {
      return null;
    }

    return (
      <WindowChromeHost
        key={id}
        title={title}
        autoFocus={hasRenderedOnce}
        className={animating ? styles.animating : undefined}
        style={{
          left: windowLayout.x,
          top: windowLayout.y,
          width: windowLayout.width,
          height: windowLayout.height,
          zIndex: windowLayout.z,
        }}
        onClose={onClose}
        onPointerDownCapture={() => bringToFront(id)}
        onTitleBarPointerDown={(event) => {
          if (!boardRef.current) {
            return;
          }
          const windowEl = event.currentTarget.parentElement as HTMLElement;
          startDrag(id, event, boardRef.current, windowEl);
        }}
        onResizeHandlePointerDown={(event) => {
          if (!boardRef.current) {
            return;
          }
          const windowEl = event.currentTarget.parentElement as HTMLElement;
          startResize(id, event, boardRef.current, windowEl);
        }}
      >
        {content}
      </WindowChromeHost>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <select
          className={styles.presetSelect}
          aria-label="Load layout preset"
          value={presetSelection}
          onChange={(event) => {
            const name = event.target.value;
            if (name) {
              handleApplyPreset(name);
            }
            setPresetSelection("");
          }}
        >
          <option value="" disabled>
            Load preset…
          </option>
          {presetNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <Button type="button" variant="ghost" onClick={handleSavePreset}>
          Save as preset
        </Button>
        <Button type="button" variant="ghost" onClick={reset}>
          Reset layout
        </Button>
      </div>

      <div className={styles.board} ref={boardRef} data-testid="desktop-board">
        {catalog.map((entry) =>
          renderWindow(entry.id, entry.title, entry.render(), () =>
            toggle(entry.id),
          ),
        )}

        {Object.entries(dynamicWindows).map(([id, dynamicEntry]) =>
          renderWindow(id, dynamicEntry.title, dynamicEntry.render(), () =>
            closeWindow(id),
          ),
        )}
      </div>
    </div>
  );
}
