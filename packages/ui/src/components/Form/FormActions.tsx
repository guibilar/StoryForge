import type { HTMLAttributes } from "react";

import { cx } from "../../lib/cx";
import styles from "./FormActions.module.css";

export type FormActionsProps = HTMLAttributes<HTMLDivElement>;

export function FormActions({ className, ...rest }: FormActionsProps) {
  return <div className={cx(styles.actions, className)} {...rest} />;
}
