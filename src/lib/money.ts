import type { Currency } from "@/data/types";

/** Per-currency totals. LRD and USD are never added together. */
export type CurrencyTotals = Record<Currency, number>;

export const emptyTotals = (): CurrencyTotals => ({ LRD: 0, USD: 0 });

const fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtWhole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** `LRD 12,500.00` / `USD 50.00`. Negative values render as `LRD −3,000.00`. */
export function formatMoney(minor: number, currency: Currency): string {
  const sign = minor < 0 ? "−" : "";
  return `${currency} ${sign}${fmt.format(Math.abs(minor) / 100)}`;
}

/** Amount only, no currency code: `12,500.00`. */
export function formatAmount(minor: number): string {
  const sign = minor < 0 ? "−" : "";
  return `${sign}${fmt.format(Math.abs(minor) / 100)}`;
}

/** Compact amount for chart labels: `412k`, `2.2k`. */
export function formatCompact(minor: number): string {
  const major = minor / 100;
  if (Math.abs(major) >= 1_000_000) return `${(major / 1_000_000).toFixed(1)}m`;
  if (Math.abs(major) >= 10_000) return `${fmtWhole.format(Math.round(major / 1000))}k`;
  if (Math.abs(major) >= 1_000) return `${(major / 1000).toFixed(1)}k`;
  return fmtWhole.format(major);
}

/** Parse a user-typed amount ("1,250.5") into minor units. Returns null if invalid. */
export function parseAmountToMinor(input: string): number | null {
  const clean = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const minor = Math.round(parseFloat(clean) * 100);
  return minor > 0 ? minor : null;
}
