import { useRef } from "react";
import type { ReactNode } from "react";
import { Button, Dock, Window } from "@storyforge/ui";

import { visibleWindowCatalog } from "../lib/windowCatalog";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import type { CampaignRole } from "../gql/graphql";
import styles from "./DesktopBoard.module.css";

export interface DesktopBoardProps {
  role?: CampaignRole;
}

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
  } = useDesktopWindows();
  const catalog = visibleWindowCatalog(role);

  const dockItems = catalog.map((entry) => ({
    id: entry.id,
    title: entry.title,
    open: !layout[entry.id].hidden,
  }));

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
      <Window
        key={id}
        title={title}
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
      </Window>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
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

        <Dock items={dockItems} onToggle={toggle} className={styles.dock} />
      </div>
    </div>
  );
}
