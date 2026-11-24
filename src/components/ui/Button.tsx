import type { ButtonHTMLAttributes } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "border border-accent bg-accent text-white hover:bg-accent/90",
  secondary: "border border-line bg-surface text-fg hover:bg-subtle",
  ghost: "border border-transparent text-muted hover:bg-subtle hover:text-fg",
  danger: "border border-danger bg-danger text-white hover:bg-danger/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-9 gap-2 px-3.5 text-sm",
  icon: "h-9 w-9 text-sm",
};

/** Class names for elements that should look like a button (e.g. next/link). */
export function buttonClasses(variant: ButtonVariant = "secondary", size: ButtonSize = "md") {
  return cn(
    "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconDefinition;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} suppressHydrationWarning className={cn(buttonClasses(variant, size), className)} {...props}>
      {icon && <FontAwesomeIcon icon={icon} />}
      {children}
    </button>
  );
}
