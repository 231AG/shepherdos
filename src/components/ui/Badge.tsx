import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "active" | "new" | "inactive" | "excused" | "neutral" | "navy" | "gold" | "danger" | "outline";

const tones: Record<BadgeTone, string> = {
  active: "bg-teal-soft text-teal-ink",
  new: "bg-gold-soft text-gold-ink",
  inactive: "bg-danger-soft text-danger-ink",
  excused: "bg-slate-soft text-slate-ink",
  neutral: "bg-navy-50 text-navy-700",
  navy: "bg-navy text-white",
  gold: "bg-gold text-navy",
  danger: "bg-danger-ink text-white",
  outline: "border border-line-strong text-navy-700 bg-white",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}
