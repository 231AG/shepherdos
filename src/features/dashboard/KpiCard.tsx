import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function KpiCard({
  label,
  value,
  note,
  tone = "default",
  noteTone = "muted",
  href,
  onClick,
}: {
  label: ReactNode;
  value: ReactNode;
  note: ReactNode;
  tone?: "default" | "danger" | "gold";
  noteTone?: "muted" | "teal" | "gold";
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-heading text-[28px] font-extrabold leading-none sm:text-[32px]",
          tone === "danger" ? "text-danger-ink" : tone === "gold" ? "text-gold-ink" : "text-navy",
        )}
      >
        {value}
      </p>
      <p className={cn("mt-2 text-xs", noteTone === "teal" ? "font-semibold text-teal-ink" : noteTone === "gold" ? "font-semibold text-gold-ink" : "text-muted")}>
        {note}
      </p>
    </>
  );
  const cls = "block rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5";
  if (href)
    return (
      <Link href={href} onClick={onClick} className={cn(cls, "transition-[border-color,box-shadow] hover:border-navy-200 hover:shadow-raised")}>
        {body}
      </Link>
    );
  return <div className={cls}>{body}</div>;
}
