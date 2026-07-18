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
  // Shows a refresh button in the title bar (before the close button) when
  // set; omit to leave the title bar as close-only.
  onRefresh?: () => void;
  // Covers the window in a blocking overlay — the overlay sits above the
  // title bar, body, and resize handle in paint order, so it intercepts
  // pointer events for all of them without each needing its own disabled
  // state.
  isLoading?: boolean;
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
  onRefresh,
  isLoading = false,
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
        {onRefresh ? (
          <button
            type="button"
            className={styles.refresh}
            aria-label={`Refresh ${title}`}
            onClick={onRefresh}
            disabled={isLoading}
          >
            ⟳
          </button>
        ) : null}
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
      {isLoading ? (
        <div className={styles.loadingOverlay} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.srOnly}>Loading {title}…</span>
        </div>
      ) : null}
    </div>
  );
}
