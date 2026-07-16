import { cx } from "../../lib/cx";
import styles from "./Dock.module.css";

export interface DockItem {
  id: string;
  title: string;
  open: boolean;
}

export interface DockProps {
  items: DockItem[];
  onToggle: (id: string) => void;
  className?: string;
}

export function Dock({ items, onToggle, className }: DockProps) {
  return (
    <div className={cx(styles.dock, className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cx(styles.item, item.open && styles.open)}
          aria-pressed={item.open}
          onClick={() => onToggle(item.id)}
        >
          {item.title}
          <span className={styles.dot} />
        </button>
      ))}
    </div>
  );
}
