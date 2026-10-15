import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  parseISO,
  previousSunday,
  isSunday,
  startOfDay,
} from "date-fns";

/** The demo clock. Everything in the seed is generated relative to this. */
export function today(): Date {
  return startOfDay(new Date());
}

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function fromISO(s: string): Date {
  return parseISO(s);
}

/** Most recent Sunday on or before `d`. */
export function lastSunday(d: Date): Date {
  return isSunday(d) ? startOfDay(d) : previousSunday(startOfDay(d));
}

/** The Sunday check-in targets: today if Sunday, otherwise the next Sunday. */
export function upcomingSunday(d: Date): Date {
  return isSunday(d) ? startOfDay(d) : addDays(lastSunday(d), 7);
}

export function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === "string" ? parseISO(a) : a;
  const db = typeof b === "string" ? parseISO(b) : b;
  return differenceInCalendarDays(db, da);
}

export function fmtDate(s: string | Date, pattern = "d MMM yyyy"): string {
  return format(typeof s === "string" ? parseISO(s) : s, pattern);
}

export function fmtTime(s: string | Date): string {
  return format(typeof s === "string" ? parseISO(s) : s, "h:mm a");
}

/** "Due today", "Due Fri", "Overdue 2d" style labels for tasks. */
export function dueLabel(dueOn: string, now: Date): { label: string; tone: "today" | "soon" | "overdue" } {
  const diff = differenceInCalendarDays(parseISO(dueOn), now);
  if (diff < 0) return { label: `Overdue ${-diff}d`, tone: "overdue" };
  if (diff === 0) return { label: "Due today", tone: "today" };
  if (diff === 1) return { label: "Due tomorrow", tone: "soon" };
  if (diff < 7) return { label: `Due ${format(parseISO(dueOn), "EEE")}`, tone: "soon" };
  return { label: `Due ${format(parseISO(dueOn), "d MMM")}`, tone: "soon" };
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export { isSameDay, addDays };
