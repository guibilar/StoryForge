import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

import { cx } from "../../lib/cx";
import styles from "./Select.module.css";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, ...rest }, ref) {
    return (
      <select ref={ref} className={cx(styles.select, className)} {...rest} />
    );
  },
);
