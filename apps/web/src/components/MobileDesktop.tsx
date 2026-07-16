import { useState } from "react";

import { WINDOW_CATALOG } from "../lib/windowCatalog";
import styles from "./MobileDesktop.module.css";

export function MobileDesktop() {
  const [activeId, setActiveId] = useState(WINDOW_CATALOG[0].id);
  const active =
    WINDOW_CATALOG.find((entry) => entry.id === activeId) ?? WINDOW_CATALOG[0];

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>{active.title}</h2>
        {active.render()}
      </div>

      <div className={styles.tabs}>
        {WINDOW_CATALOG.map((entry) => (
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
