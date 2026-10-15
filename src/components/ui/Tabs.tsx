"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
}

/** Accessible tab list (arrow keys move between tabs). Panels are rendered by the caller. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].id);
  };
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 overflow-x-auto rounded-xl bg-navy-50 p-1", className)}>
      {items.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors",
              selected ? "bg-white text-navy shadow-card" : "text-navy-600 hover:text-navy",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="tabular text-xs text-muted">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Filter chips (single select), as in the check-in and directory mockups. */
export function Chips<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {items.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors md:min-h-9",
              selected ? "border-navy bg-navy text-white" : "border-line-strong bg-white text-navy hover:bg-navy-50",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("tabular", selected ? "text-navy-200" : "text-muted")}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
