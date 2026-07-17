import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { cx } from "../../lib/cx";
import styles from "./Checkbox.module.css";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, className, ...rest }, ref) {
    return (
      <label className={cx(styles.pill, className)}>
        <input ref={ref} type="checkbox" {...rest} />
        {label}
      </label>
    );
  },
);
