import { useState } from "react";

import { visibleWindowCatalog } from "../lib/windowCatalog";
import type { CampaignRole } from "../gql/graphql";
import styles from "./MobileDesktop.module.css";

export interface MobileDesktopProps {
  role?: CampaignRole;
}

export function MobileDesktop({ role }: MobileDesktopProps) {
  const catalog = visibleWindowCatalog(role);
  const [activeId, setActiveId] = useState(catalog[0].id);
  const active = catalog.find((entry) => entry.id === activeId) ?? catalog[0];

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>{active.title}</h2>
        {active.render()}
      </div>

      <div className={styles.tabs}>
        {catalog.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={entry.id === activeId ? styles.activeTab : styles.tab}
            aria-pressed={entry.id === activeId}
            onClick={() => setActiveId(entry.id)}
          >
            {entry.title}
          </button>
        ))}
      </div>
    </div>
  );
}
