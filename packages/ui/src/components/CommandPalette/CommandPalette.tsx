import { useEffect, useMemo, useRef } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { cx } from "../../lib/cx";
import styles from "./CommandPalette.module.css";

export interface CommandPaletteItem {
  id: string;
  icon?: ReactNode;
  label: string;
  sublabel?: string;
}

export interface CommandPaletteSection {
  label: string;
  items: CommandPaletteItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  sections: CommandPaletteSection[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
  onCommit: (id: string) => void;
  onClose: () => void;
  className?: string;
}

export function CommandPalette({
  open,
  query,
  onQueryChange,
  sections,
  activeId,
  onActiveChange,
  onCommit,
  onClose,
  className,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const flatIds = useMemo(
    () => sections.flatMap((section) => section.items.map((item) => item.id)),
    [sections],
  );

  const isEmpty = sections.every((section) => section.items.length === 0);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function moveActive(direction: 1 | -1) {
    if (flatIds.length === 0) {
      return;
    }

    const currentIndex = activeId ? flatIds.indexOf(activeId) : -1;
    const nextIndex = Math.min(
      Math.max(currentIndex + direction, 0),
      flatIds.length - 1,
    );

    onActiveChange(flatIds[nextIndex]!);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Enter":
        event.preventDefault();
        if (activeId !== null) {
          onCommit(activeId);
        }
        break;
      case "Escape":
        event.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className={cx(styles.backdrop, className)}
      onClick={handleBackdropClick}
    >
      <div className={styles.panel} role="dialog" aria-modal="true">
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder="Type a command or search…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-activedescendant={activeId ?? undefined}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
        />

        {isEmpty ? (
          <p className={styles.empty}>No matches</p>
        ) : (
          <div className={styles.list} id="command-palette-list" role="listbox">
            {sections.map((section) => (
              <div key={section.label} className={styles.section}>
                <div className={styles.sectionLabel}>{section.label}</div>
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    id={item.id}
                    role="option"
                    aria-selected={item.id === activeId}
                    className={cx(
                      styles.item,
                      item.id === activeId && styles.active,
                    )}
                    onMouseEnter={() => onActiveChange(item.id)}
                    onClick={() => {
                      onActiveChange(item.id);
                      onCommit(item.id);
                    }}
                  >
                    {item.icon ? (
                      <span className={styles.icon}>{item.icon}</span>
                    ) : null}
                    <span className={styles.itemText}>
                      <span className={styles.itemLabel}>{item.label}</span>
                      {item.sublabel ? (
                        <span className={styles.itemSublabel}>
                          {item.sublabel}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
