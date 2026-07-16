import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cx } from "../../lib/cx";
import styles from "./Link.module.css";

type LinkOwnProps<E extends ElementType> = { as?: E };

export type LinkProps<E extends ElementType = "a"> = LinkOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof LinkOwnProps<E>>;

export function Link<E extends ElementType = "a">({
  as,
  className,
  ...rest
}: LinkProps<E>) {
  const Component = as ?? "a";
  return <Component className={cx(styles.link, className)} {...rest} />;
}
