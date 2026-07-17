import { useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { cx } from "../../lib/cx";
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  items,
  activeId,
  onChange,
  children,
  className,
}: TabsProps) {
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (items.length === 0) {
      return;
    }

    const currentIndex = items.findIndex((item) => item.id === activeId);
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % items.length;
        break;
      case "ArrowLeft":
        nextIndex =
          currentIndex === -1
            ? 0
            : (currentIndex - 1 + items.length) % items.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextItem = items[nextIndex];
    tabRefs.current[nextIndex]?.focus();
    onChange(nextItem.id);
  }

  return (
    <div className={className}>
      <div role="tablist" className={styles.tablist} onKeyDown={handleKeyDown}>
        {items.map((item, index) => {
          const selected = item.id === activeId;

          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-tabpanel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className={cx(styles.tab, selected && styles.active)}
              onClick={() => onChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-tabpanel-${activeId}`}
        aria-labelledby={`${baseId}-tab-${activeId}`}
        className={styles.panel}
      >
        {children}
      </div>
    </div>
  );
}
