import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

import { cx } from "../../lib/cx";
import styles from "./Textarea.module.css";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cx(styles.textarea, className)}
        {...rest}
      />
    );
  },
);
