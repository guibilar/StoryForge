import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cx } from "../../lib/cx";
import styles from "./Button.module.css";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "text" | "destructive" | "tab";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cx(styles.button, styles[variant], className)}
        {...rest}
      />
    );
  },
);
