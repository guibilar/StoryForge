import type { HTMLAttributes } from "react";

import { cx } from "../../lib/cx";
import styles from "./FormError.module.css";

export type FormErrorProps = HTMLAttributes<HTMLParagraphElement>;

export function FormError({ className, children, ...rest }: FormErrorProps) {
  if (!children) {
    return null;
  }

  return (
    <p role="alert" className={cx(styles.formError, className)} {...rest}>
      {children}
    </p>
  );
}
