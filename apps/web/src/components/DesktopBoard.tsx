import { useRef } from "react";
import { Dock, Window } from "@storyforge/ui";

import { useDesktopLayout } from "../hooks/useDesktopLayout";
import { DEFAULT_LAYOUT, WINDOW_CATALOG } from "../lib/windowCatalog";
import styles from "./DesktopBoard.module.css";

export interface DesktopBoardProps {
  campaignId: string;
}

export function DesktopBoard({ campaignId }: DesktopBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const { layout, bringToFront, toggle, startDrag, startResize, reset } =
    useDesktopLayout(campaignId, DEFAULT_LAYOUT);

  const dockItems = WINDOW_CATALOG.map((entry) => ({
    id: entry.id,
    title: entry.title,
    open: !layout[entry.id].hidden,
  }));

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.resetBtn} onClick={reset}>
          Reset layout
        </button>
      </div>

      <div className={styles.board} ref={boardRef} data-testid="desktop-board">
        {WINDOW_CATALOG.map((entry) => {
          const windowLayout = layout[entry.id];
          if (windowLayout.hidden) {
            return null;
          }

          return (
            <Window
              key={entry.id}
              title={entry.title}
              style={{
                left: windowLayout.x,
                top: windowLayout.y,
                width: windowLayout.width,
                height: windowLayout.height,
                zIndex: windowLayout.z,
              }}
              onClose={() => toggle(entry.id)}
              onPointerDownCapture={() => bringToFront(entry.id)}
              onTitleBarPointerDown={(event) => {
                if (!boardRef.current) {
                  return;
                }
                const windowEl = event.currentTarget
                  .parentElement as HTMLElement;
                startDrag(entry.id, event, boardRef.current, windowEl);
              }}
              onResizeHandlePointerDown={(event) => {
                if (!boardRef.current) {
                  return;
                }
                const windowEl = event.currentTarget
                  .parentElement as HTMLElement;
                startResize(entry.id, event, boardRef.current, windowEl);
              }}
            >
              {entry.render()}
            </Window>
          );
        })}

        <Dock items={dockItems} onToggle={toggle} className={styles.dock} />
      </div>
    </div>
  );
}
