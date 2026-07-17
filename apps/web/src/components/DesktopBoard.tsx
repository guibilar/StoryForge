import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button, Dock, Window } from "@storyforge/ui";

import { useDesktopLayout } from "../hooks/useDesktopLayout";
import { DEFAULT_LAYOUT, visibleWindowCatalog } from "../lib/windowCatalog";
import {
  DesktopWindowsContext,
  type OpenWindowRequest,
} from "../lib/DesktopWindowsContext";
import type { CampaignRole } from "../gql/graphql";
import styles from "./DesktopBoard.module.css";

export interface DesktopBoardProps {
  campaignId: string;
  role?: CampaignRole;
}

interface DynamicWindowEntry {
  title: string;
  render: () => ReactNode;
}

export function DesktopBoard({ campaignId, role }: DesktopBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const {
    layout,
    bringToFront,
    toggle,
    startDrag,
    startResize,
    reset,
    openWindow: openLayoutWindow,
    closeWindow: closeLayoutWindow,
  } = useDesktopLayout(campaignId, DEFAULT_LAYOUT);
  const catalog = visibleWindowCatalog(role);

  // Windows opened at runtime for an id that isn't in windowCatalog.ts (e.g.
  // an entity detail window). useDesktopLayout only tracks position/size/z
  // for these; the title + content to render lives here.
  const [dynamicWindows, setDynamicWindows] = useState<
    Record<string, DynamicWindowEntry>
  >({});

  const openWindow = useCallback(
    (request: OpenWindowRequest) => {
      setDynamicWindows((current) => ({
        ...current,
        [request.id]: { title: request.title, render: request.render },
      }));
      openLayoutWindow(request.id, {
        x: request.x,
        y: request.y,
        width: request.width,
        height: request.height,
      });
    },
    [openLayoutWindow],
  );

  const closeWindow = useCallback(
    (id: string) => {
      closeLayoutWindow(id);
      setDynamicWindows((current) => {
        const rest = { ...current };
        delete rest[id];
        return rest;
      });
    },
    [closeLayoutWindow],
  );

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
    <DesktopWindowsContext.Provider value={{ openWindow, closeWindow }}>
      <div className={styles.wrap}>
        <div className={styles.toolbar}>
          <Button type="button" variant="ghost" onClick={reset}>
            Reset layout
          </Button>
        </div>

        <div
          className={styles.board}
          ref={boardRef}
          data-testid="desktop-board"
        >
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
    </DesktopWindowsContext.Provider>
  );
}
