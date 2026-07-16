import type { CSSProperties, PointerEvent, ReactNode } from "react";

import { cx } from "../../lib/cx";
import styles from "./Window.module.css";

export interface WindowProps {
  title: string;
  style?: CSSProperties;
  onClose: () => void;
  onTitleBarPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onResizeHandlePointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerDownCapture?: (event: PointerEvent<HTMLDivElement>) => void;
  className?: string;
  children: ReactNode;
}

export function Window({
  title,
  style,
  onClose,
  onTitleBarPointerDown,
  onResizeHandlePointerDown,
  onPointerDownCapture,
  className,
  children,
}: WindowProps) {
  return (
    <div
      className={cx(styles.window, className)}
      style={style}
      onPointerDownCapture={onPointerDownCapture}
    >
      <div className={styles.titleBar} onPointerDown={onTitleBarPointerDown}>
        <span className={styles.title}>{title}</span>
        <button
          type="button"
          className={styles.close}
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className={styles.body}>{children}</div>
      <div
        className={styles.resizeHandle}
        aria-label={`Resize ${title}`}
        onPointerDown={onResizeHandlePointerDown}
      />
    </div>
  );
}
