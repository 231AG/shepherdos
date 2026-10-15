import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Avatar({ initials, tone = "neutral", size = "md", className }: { initials: string; tone?: "neutral" | "navy" | "teal" | "gold"; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-12 text-base",
        tone === "neutral" && "bg-navy-50 text-navy-700",
        tone === "navy" && "bg-navy text-white",
        tone === "teal" && "bg-teal-ink text-white",
        tone === "gold" && "bg-gold text-navy",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-navy-100/70", className)} />;
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      {icon && <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-600">{icon}</div>}
      <p className="font-heading text-base font-bold text-navy">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Small uppercase label used for table-ish metadata and card captions. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-semibold uppercase tracking-wider text-muted", className)}>{children}</p>;
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
