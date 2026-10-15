"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export interface Column {
  key: string;
  /** Short x-axis label, e.g. "Oct 11". */
  label: string;
  value: number;
  /** Accessible description and tooltip lines. */
  ariaLabel: string;
  tooltip: string[];
}

function niceStep(max: number): number {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/**
 * Single-series column chart (mockup style). Latest column highlighted in
 * gold. Every column is a focusable button with its own tooltip; a hidden
 * table repeats the values for screen readers.
 */
export function ColumnChart({
  columns,
  caption,
  formatValue = (v) => v.toLocaleString("en-US"),
  formatTick = formatValue,
  height = "h-56 sm:h-60",
  highlightLast = true,
}: {
  columns: Column[];
  caption: string;
  formatValue?: (v: number) => string;
  formatTick?: (v: number) => string;
  height?: string;
  highlightLast?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...columns.map((c) => c.value));
  const step = niceStep(max * 1.08);
  const top = Math.ceil((max * 1.08) / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const peak = columns.reduce((m, c, i) => (c.value > columns[m].value ? i : m), 0);

  return (
    <figure className="relative">
      <div className={cn("relative mt-4", height)} onPointerLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(t / top) * 100}%` }} aria-hidden>
            <span className="tabular w-8 shrink-0 translate-y-px text-right text-[10px] text-muted">{formatTick(t)}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ))}
        <div className="absolute inset-y-0 left-10 right-0 flex items-end gap-1 sm:gap-2">
          {columns.map((c, i) => {
            const latest = highlightLast && i === columns.length - 1;
            const showLabel = i === columns.length - 1 || i === peak;
            return (
              <div key={c.key} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <span
                  className={cn("tabular mb-1 whitespace-nowrap text-[10px] font-semibold text-navy-700 sm:text-[11px]", !showLabel && "hidden lg:inline")}
                  aria-hidden
                >
                  {formatValue(c.value)}
                </span>
                <button
                  type="button"
                  aria-label={c.ariaLabel}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className={cn(
                    "w-full max-w-9 rounded-t-[4px] transition-opacity focus-visible:outline-offset-1",
                    latest ? "bg-gold" : "bg-teal",
                    active !== null && active !== i && "opacity-60",
                  )}
                  style={{ height: `${Math.max(c.value > 0 ? 1 : 0, (c.value / top) * 100)}%` }}
                />
                {active === i && (
                  <div
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-1 w-max max-w-56 rounded-xl bg-navy-950 px-3 py-2 text-xs text-white shadow-overlay",
                      i < 2 ? "left-0" : i > columns.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    {c.tooltip.map((line, j) => (
                      <p key={j} className={cn("tabular", j === 0 ? "font-semibold" : j === 1 ? "mt-0.5" : "text-navy-200")}>
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-10 mt-2 flex gap-1 sm:gap-2" aria-hidden>
        {columns.map((c, i) => (
          <span
            key={c.key}
            className={cn("min-w-0 flex-1 whitespace-nowrap text-center text-[10px] text-muted", i % 2 === (columns.length - 1) % 2 ? "" : "max-sm:invisible")}
          >
            {c.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>{caption}</caption>
          <tbody>
            {columns.map((c) => (
              <tr key={c.key}>
                <td>{c.ariaLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
