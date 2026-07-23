import { useState } from "react";
import { Icon } from "@storyforge/ui";

import { visibleWindowCatalog } from "../lib/windowCatalog";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import type { CampaignRole } from "../gql/graphql";
import styles from "./DesktopIcons.module.css";

export interface DesktopIconsProps {
  role?: CampaignRole;
}

// The catalog windows as desktop shortcuts. Double-click (or Enter) opens,
// matching every desktop people already use; a single click only selects, so
// dragging across icons doesn't fling six windows open.
export function DesktopIcons({ role }: DesktopIconsProps) {
  const { layout, toggle, restoreWindow, bringToFront } = useDesktopWindows();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const catalog = visibleWindowCatalog(role);

  function open(id: string) {
    const window = layout[id];
    if (!window || window.hidden) {
      toggle(id);
      return;
    }
    // Already open: opening it again means "show me that window", which for a
    // minimized one is a restore and for a visible one is a raise.
    if (window.minimized) {
      restoreWindow(id);
      return;
    }
    bringToFront(id);
  }

  return (
    <ul className={styles.icons}>
      {catalog.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            className={styles.icon}
            aria-pressed={selectedId === entry.id}
            onClick={() => setSelectedId(entry.id)}
            onDoubleClick={() => open(entry.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open(entry.id);
              }
            }}
          >
            <span className={styles.glyph} aria-hidden="true">
              <Icon icon={entry.icon} size={22} />
            </span>
            <span className={styles.label}>{entry.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
