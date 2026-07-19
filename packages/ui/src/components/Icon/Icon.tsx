import type { LucideIcon, LucideProps } from "lucide-react";

export interface IconProps extends LucideProps {
  icon: LucideIcon;
}

export function Icon({
  icon: IconComponent,
  size = 18,
  strokeWidth = 1.75,
  ...rest
}: IconProps) {
  return <IconComponent size={size} strokeWidth={strokeWidth} {...rest} />;
}
