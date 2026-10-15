import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "teal" | "danger" | "ghost" | "gold";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 select-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy-700 shadow-card",
  secondary: "bg-white text-navy border border-line-strong hover:bg-navy-50 hover:border-navy-200",
  teal: "bg-teal-ink text-white hover:bg-navy shadow-card",
  danger: "bg-danger-ink text-white hover:bg-danger shadow-card",
  ghost: "text-navy hover:bg-navy-50",
  gold: "bg-gold text-navy hover:brightness-95 shadow-card",
};

// Tap targets stay at least 44px on touch screens; desktop can be denser.
const sizes: Record<ButtonSize, string> = {
  sm: "h-11 md:h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export function Button({ variant = "primary", size = "md", className, icon, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export function ButtonLink({ variant = "primary", size = "md", className, icon, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** Square icon-only button. Always pass an aria-label. */
export function IconButton({
  className,
  variant = "ghost",
  type = "button",
  ...rest
}: ComponentProps<"button"> & { "aria-label": string; variant?: "ghost" | "secondary" | "primary" }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
        variant === "ghost" && "text-navy hover:bg-navy-50",
        variant === "secondary" && "border border-line-strong bg-white text-navy hover:bg-navy-50",
        variant === "primary" && "bg-navy text-white hover:bg-navy-700",
        className,
      )}
      {...rest}
    />
  );
}
