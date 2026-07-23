import { useMemo } from "react";
import { IconButton } from "@storyforge/ui";
import { X } from "lucide-react";

import { visibleWindowCatalog } from "../lib/windowCatalog";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { activeWindowId } from "../lib/taskbarItems";
import type { CampaignRole } from "../gql/graphql";
import styles from "./MobileDesktop.module.css";

export interface MobileDesktopProps {
  role?: CampaignRole;
}

// The same windows as the desktop shell, one at a time: a phone has no room
// for overlapping windows, but it shares the state — the taskbar switches
// between them and the start menu opens them, exactly as on a desktop, so
// there is no second navigation model to keep in sync.
export function MobileDesktop({ role }: MobileDesktopProps) {
  const { layout, dynamicWindows, toggle, closeWindow } = useDesktopWindows();
  const catalog = useMemo(() => visibleWindowCatalog(role), [role]);

  const activeId = activeWindowId({ layout });
  const catalogEntry = catalog.find((entry) => entry.id === activeId);
  const dynamicEntry = activeId ? dynamicWindows[activeId] : undefined;
  const active = catalogEntry ?? dynamicEntry;

  if (!activeId || !active) {
    return (
      <div className={styles.wrap}>
        <p className={styles.empty}>
          Nothing open. Use <strong>StoryForge</strong> in the bar below to open
          a window.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.panelBar}>
          <h2 className={styles.panelTitle}>{active.title}</h2>
          <IconButton
            label={`Close ${active.title}`}
            icon={X}
            onClick={() =>
              catalogEntry ? toggle(activeId) : closeWindow(activeId)
            }
          />
        </div>
        <div className={styles.panelBody}>{active.render()}</div>
      </div>
    </div>
  );
}
