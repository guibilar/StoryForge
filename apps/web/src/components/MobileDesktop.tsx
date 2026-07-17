import { useState } from "react";
import { Button } from "@storyforge/ui";

import { visibleWindowCatalog } from "../lib/windowCatalog";
import type { CampaignRole } from "../gql/graphql";
import styles from "./MobileDesktop.module.css";

export interface MobileDesktopProps {
  role?: CampaignRole;
}

export function MobileDesktop({ role }: MobileDesktopProps) {
  const catalog = visibleWindowCatalog(role);
  const [activeId, setActiveId] = useState(catalog[0]?.id);
  const active = catalog.find((entry) => entry.id === activeId) ?? catalog[0];
  const effectiveActiveId = active?.id;

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>{active?.title}</h2>
        {active?.render()}
      </div>

      <div className={styles.tabs}>
        {catalog.map((entry) => (
          <Button
            key={entry.id}
            type="button"
            variant="tab"
            className={styles.tab}
            aria-pressed={entry.id === effectiveActiveId}
            onClick={() => setActiveId(entry.id)}
          >
            {entry.title}
          </Button>
        ))}
      </div>
    </div>
  );
}
