import { forwardRef } from "react";
import type { LabelHTMLAttributes } from "react";

import { cx } from "../../lib/cx";
import styles from "./Label.module.css";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...rest },
  ref,
) {
  return <label ref={ref} className={cx(styles.label, className)} {...rest} />;
});
