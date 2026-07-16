import { forwardRef } from "react";
import type { FormHTMLAttributes } from "react";

import { cx } from "../../lib/cx";
import styles from "./Form.module.css";

export type FormProps = FormHTMLAttributes<HTMLFormElement>;

export const Form = forwardRef<HTMLFormElement, FormProps>(function Form(
  { className, ...rest },
  ref,
) {
  return <form ref={ref} className={cx(styles.form, className)} {...rest} />;
});
