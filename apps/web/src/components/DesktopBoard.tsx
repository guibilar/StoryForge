import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { visibleWindowCatalog } from "../lib/windowCatalog";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { geometryForZone } from "../lib/windowSnap";
import type { BoardSize, SnapZone, WindowGeometry } from "../lib/windowSnap";
import type { CampaignRole } from "../gql/graphql";
import { DesktopContextMenu } from "./DesktopContextMenu";
import { DesktopIcons } from "./DesktopIcons";
import { WindowChromeHost } from "./WindowChromeHost";
import styles from "./DesktopBoard.module.css";

export interface DesktopBoardProps {
  campaignId: string;
  role?: CampaignRole;
}

// The desk surface: icons on the wallpaper, the open windows above them, and
// the right-click menu. Window state itself is owned by CampaignDesktopPage
// via useDesktopWindowsController and reached here through
// DesktopWindowsContext — see that file for why it isn't local state.
export function DesktopBoard({ campaignId, role }: DesktopBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const {
    layout,
    bringToFront,
    toggle,
    minimize,
    toggleMaximize,
    startDrag,
    startResize,
    dynamicWindows,
    closeWindow,
  } = useDesktopWindows();
  const catalog = useMemo(() => visibleWindowCatalog(role), [role]);

  // Each window's content element is built once and reused across renders, so
  // a board-level state change (bringing a window to front, applying a
  // preset, opening something else) reconciles the chrome but hits React's
  // same-element bailout for everything inside it. Calling entry.render()
  // inline instead handed every window a brand-new element tree every time
  // the board re-rendered, re-rendering the Leaflet map, the relationship
  // graph and every list along with it.
  const catalogContent = useMemo(
    () => new Map(catalog.map((entry) => [entry.id, entry.render()])),
    [catalog],
  );
  const dynamicContent = useMemo(
    () =>
      new Map(
        Object.entries(dynamicWindows).map(([id, entry]) => [
          id,
          entry.render(),
        ]),
      ),
    [dynamicWindows],
  );

  // False only during this DesktopBoard instance's very first render.
  // Windows that are already visible then are just part of the
  // initial/persisted layout for this campaign — nobody "opened" them, so
  // they shouldn't steal keyboard focus from wherever the page naturally
  // starts. A window that mounts on any later render (a toggle, a fresh
  // dynamic openWindow call) genuinely was just opened by a user action, so
  // it should get Window's autoFocus behavior — see useFocusTrap.
  const [hasRenderedOnce, setHasRenderedOnce] = useState(false);
  useEffect(() => {
    // One-shot mount-boundary flag, not state derived from props/other
    // state — the pattern react-hooks/set-state-in-effect warns against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasRenderedOnce(true);
  }, []);

  // Geometry transitions are on by default — that's what makes snapping,
  // maximizing, tiling and applying a preset animate — and off for exactly
  // as long as a pointer gesture is driving the DOM directly, where a
  // transition would make dragging feel like it lags behind the cursor.
  const [gesturing, setGesturing] = useState(false);
  useEffect(() => {
    if (!gesturing) {
      return;
    }
    const end = () => setGesturing(false);
    window.addEventListener("pointerup", end);
    return () => window.removeEventListener("pointerup", end);
  }, [gesturing]);

  const boardSize = useCallback((): BoardSize => {
    const el = boardRef.current;
    return { width: el?.clientWidth ?? 0, height: el?.clientHeight ?? 0 };
  }, []);

  // The preview holds a rect rather than the zone it came from: measuring the
  // board is a ref read, which belongs in the gesture callback that fires it,
  // not in render.
  const [ghost, setGhost] = useState<WindowGeometry | null>(null);
  const handleSnapZoneChange = useCallback(
    (zone: SnapZone | null) => {
      setGhost(zone ? geometryForZone(zone, boardSize()) : null);
    },
    [boardSize],
  );

  function renderWindow(
    id: string,
    title: string,
    content: ReactNode,
    onClose: () => void,
  ) {
    const windowLayout = layout[id];
    // Minimized windows stay in the layout (and on the taskbar) but leave the
    // board entirely — unmounting rather than hiding keeps a rolled-down
    // Leaflet map or relationship graph from re-rendering behind the scenes.
    if (!windowLayout || windowLayout.hidden || windowLayout.minimized) {
      return null;
    }

    return (
      <WindowChromeHost
        key={id}
        title={title}
        autoFocus={hasRenderedOnce}
        className={gesturing ? undefined : styles.animated}
        style={{
          left: windowLayout.x,
          top: windowLayout.y,
          width: windowLayout.width,
          height: windowLayout.height,
          zIndex: windowLayout.z,
        }}
        onClose={onClose}
        onMinimize={() => minimize(id)}
        onMaximize={() => toggleMaximize(id, boardSize())}
        onTitleBarDoubleClick={() => toggleMaximize(id, boardSize())}
        isMaximized={Boolean(windowLayout.maximized)}
        onPointerDownCapture={() => bringToFront(id)}
        onTitleBarPointerDown={(event) => {
          if (!boardRef.current) {
            return;
          }
          const windowEl = event.currentTarget.parentElement as HTMLElement;
          setGesturing(true);
          startDrag(
            id,
            event,
            boardRef.current,
            windowEl,
            handleSnapZoneChange,
          );
        }}
        onResizeHandlePointerDown={(event) => {
          if (!boardRef.current) {
            return;
          }
          const windowEl = event.currentTarget.parentElement as HTMLElement;
          setGesturing(true);
          startResize(id, event, boardRef.current, windowEl);
        }}
      >
        {content}
      </WindowChromeHost>
    );
  }

  return (
    <div className={styles.board} ref={boardRef} data-testid="desktop-board">
      <DesktopIcons role={role} />

      {catalog.map((entry) =>
        renderWindow(entry.id, entry.title, catalogContent.get(entry.id), () =>
          toggle(entry.id),
        ),
      )}

      {Object.entries(dynamicWindows).map(([id, dynamicEntry]) =>
        renderWindow(id, dynamicEntry.title, dynamicContent.get(id), () =>
          closeWindow(id),
        ),
      )}

      {ghost ? (
        <div
          className={styles.snapGhost}
          aria-hidden="true"
          style={{
            left: ghost.x,
            top: ghost.y,
            width: ghost.width,
            height: ghost.height,
          }}
        />
      ) : null}

      <DesktopContextMenu
        boardRef={boardRef}
        campaignId={campaignId}
        role={role}
      />
    </div>
  );
}
