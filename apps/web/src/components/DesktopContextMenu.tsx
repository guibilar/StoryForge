import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Icon } from "@storyforge/ui";
import {
  Grid2x2,
  Layers,
  MonitorDown,
  RotateCcw,
  Shapes,
  StickyNote,
} from "lucide-react";

import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { useQuickCreateWindows } from "../hooks/useQuickCreateWindows";
import type { CampaignRole } from "../gql/graphql";
import styles from "./DesktopContextMenu.module.css";

export interface DesktopContextMenuProps {
  boardRef: RefObject<HTMLDivElement | null>;
  campaignId: string;
  role?: CampaignRole;
}

interface MenuPosition {
  x: number;
  y: number;
}

// Right-click menu for the desk itself — window arrangement plus the two
// create actions. Right-clicking inside a window is left to the browser, the
// same way a real desktop leaves an application's own context menu alone.
export function DesktopContextMenu({
  boardRef,
  campaignId,
  role,
}: DesktopContextMenuProps) {
  const { arrange, showDesktop, reset } = useDesktopWindows();
  const { openCreateEntityWindow, openCreateNoteWindow } =
    useQuickCreateWindows(campaignId);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isWriter =
    role === "OWNER" || role === "STORYTELLER" || role === "CO_STORYTELLER";

  useEffect(() => {
    const board = boardRef.current;
    if (!board) {
      return;
    }

    function handleContextMenu(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("[data-window]")) {
        return;
      }
      event.preventDefault();
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }

    board.addEventListener("contextmenu", handleContextMenu);
    return () => board.removeEventListener("contextmenu", handleContextMenu);
  }, [boardRef]);

  useEffect(() => {
    if (!position) {
      return;
    }
    const close = (event: PointerEvent) => {
      // A pointerdown on the menu itself is the user picking an item; closing
      // here would unmount the button before its click ever landed.
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setPosition(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPosition(null);
      }
    };
    // Capture, so a click landing on a window — whose own handlers may stop
    // propagation — still dismisses the menu.
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [position]);

  if (!position) {
    return null;
  }

  function boardSize() {
    const el = boardRef.current;
    return { width: el?.clientWidth ?? 0, height: el?.clientHeight ?? 0 };
  }

  function run(action: () => void) {
    setPosition(null);
    action();
  }

  return (
    <div
      className={styles.menu}
      ref={menuRef}
      role="menu"
      aria-label="Desktop"
      style={{ left: position.x, top: position.y }}
    >
      {isWriter ? (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(openCreateNoteWindow)}
          >
            <Icon icon={StickyNote} size={14} aria-hidden="true" />
            New note
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(openCreateEntityWindow)}
          >
            <Icon icon={Shapes} size={14} aria-hidden="true" />
            New entity
          </button>
          <hr />
        </>
      ) : null}

      <button
        type="button"
        role="menuitem"
        onClick={() => run(() => arrange("tile", boardSize()))}
      >
        <Icon icon={Grid2x2} size={14} aria-hidden="true" />
        Tile windows
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => run(() => arrange("cascade", boardSize()))}
      >
        <Icon icon={Layers} size={14} aria-hidden="true" />
        Cascade windows
      </button>
      <button type="button" role="menuitem" onClick={() => run(showDesktop)}>
        <Icon icon={MonitorDown} size={14} aria-hidden="true" />
        Show desktop
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => run(reset)}>
        <Icon icon={RotateCcw} size={14} aria-hidden="true" />
        Reset layout
      </button>
    </div>
  );
}
