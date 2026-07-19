import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

import { cx } from "../../lib/cx";
import { Icon } from "../Icon/Icon";
import styles from "./IconButton.module.css";

export type IconButtonVariant = "secondary" | "ghost" | "danger";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  icon: LucideIcon;
  // Required: an icon-only control has no visible text, so this is the only
  // accessible name. Also used as the tooltip.
  label: string;
  variant?: IconButtonVariant;
  size?: number;
}

// Square icon-only action button for dense rows (list item edit/delete,
// confirm/cancel), where a full-width labelled Button would dominate the
// row it belongs to.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { icon, label, variant = "secondary", size = 15, className, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={cx(styles.iconButton, styles[variant], className)}
        {...rest}
      >
        <Icon icon={icon} size={size} aria-hidden="true" />
      </button>
    );
  },
);
