"use client";

/**
 * Reports over a date range: membership, attendance and giving.
 * Re-exported by repo.ts. Giving is always reported per currency.
 */
import { addDays, addMonths, differenceInCalendarDays, endOfDay, format, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { memo, type Db } from "./core";
import { listMembers, memberStatuses } from "./repo";
import { memberDepartmentsIndex } from "./members";
import type { Currency, GivingEntry, GivingType, Member, Service } from "./types";
import { CURRENCIES, GIVING_TYPES } from "./types";
import type { MemberStatus } from "@/lib/status";
import { emptyTotals, type CurrencyTotals } from "@/lib/money";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface Bucket {
  key: string;
  unit: "week" | "month";
  label: string;
  /** Full label for tooltips and CSV, e.g. "Week of 5 Oct 2026" or "October 2026". */
  title: string;
  from: Date;
  to: Date;
}

/** Weekly buckets for ranges up to about six months, monthly beyond that. */
export function rangeBuckets(range: DateRange): Bucket[] {
  const days = differenceInCalendarDays(range.to, range.from) + 1;
  const out: Bucket[] = [];
  if (days <= 200) {
    for (let d = startOfWeek(range.from); d <= range.to; d = addDays(d, 7)) {
      const from = d < range.from ? range.from : d;
      const end = endOfDay(addDays(d, 6));
      out.push({ key: format(d, "yyyy-MM-dd"), unit: "week", label: format(d, "MMM d"), title: `Week of ${format(d, "d MMM yyyy")}`, from, to: end > range.to ? range.to : end });
    }
  } else {
    for (let d = startOfMonth(range.from); d <= range.to; d = addMonths(d, 1)) {
      const from = d < range.from ? range.from : d;
      const end = endOfDay(addDays(addMonths(d, 1), -1));
      out.push({ key: format(d, "yyyy-MM"), unit: "month", label: format(d, "MMM"), title: format(d, "MMMM yyyy"), from, to: end > range.to ? range.to : end });
    }
  }
  return out;
}

function bucketIndex(buckets: Bucket[], d: Date): number {
  for (let i = 0; i < buckets.length; i++) if (d >= buckets[i].from && d <= buckets[i].to) return i;
  return -1;
}

const inRange = (d: Date, r: DateRange) => d >= startOfDay(r.from) && d <= endOfDay(r.to);
const rangeKey = (r: DateRange) => `${r.from.getTime()}:${r.to.getTime()}`;

/** Earliest date with recorded data (first service), for the range picker. */
export function reportDataStart(db: Db, churchId: string): Date {
  return memo(db, `reportStart:${churchId}`, () => {
    let first = db.now.toISOString();
    for (const s of db.services) if (s.church_id === churchId && s.starts_at < first) first = s.starts_at;
    return startOfDay(parseISO(first));
  });
}

/* ------------------------------------------------------------------ */
/* Membership                                                          */
/* ------------------------------------------------------------------ */

export interface MembershipReport {
  totalAtEnd: number;
  totalAtStart: number;
  joined: Member[];
  joinedByBucket: { bucket: Bucket; count: number }[];
  converted: number;
  imported: number;
  status: Record<MemberStatus, number>;
  gender: { female: number; male: number; unknown: number };
  departments: { name: string; count: number }[];
  optedOut: number;
}

export function membershipReport(db: Db, churchId: string, range: DateRange): MembershipReport {
  return memo(db, `rptMembers:${churchId}:${rangeKey(range)}`, () => {
    const members = listMembers(db, churchId);
    const fromIso = format(range.from, "yyyy-MM-dd");
    const toIso = format(range.to, "yyyy-MM-dd");
    const joined = members.filter((m) => m.joined_on >= fromIso && m.joined_on <= toIso).sort((a, b) => b.joined_on.localeCompare(a.joined_on));
    const buckets = rangeBuckets(range);
    const joinedByBucket = buckets.map((bucket) => ({ bucket, count: 0 }));
    for (const m of joined) {
      const i = bucketIndex(buckets, parseISO(m.joined_on));
      if (i >= 0) joinedByBucket[i].count++;
    }
    const statuses = memberStatuses(db, churchId);
    const status: Record<MemberStatus, number> = { new: 0, active: 0, inactive: 0, excused: 0 };
    const gender = { female: 0, male: 0, unknown: 0 };
    let optedOut = 0;
    for (const m of members) {
      status[statuses.get(m.id)!.status]++;
      gender[m.gender ?? "unknown"]++;
      if (m.sms_opt_out) optedOut++;
    }
    const deptCounts = new Map<string, number>();
    for (const md of db.member_departments) {
      if (md.church_id === churchId) deptCounts.set(md.department_id, (deptCounts.get(md.department_id) ?? 0) + 1);
    }
    const departments = db.departments
      .filter((d) => d.church_id === churchId)
      .map((d) => ({ name: d.name, count: deptCounts.get(d.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
    return {
      totalAtEnd: members.filter((m) => m.joined_on <= toIso).length,
      totalAtStart: members.filter((m) => m.joined_on < fromIso).length,
      joined,
      joinedByBucket,
      converted: joined.filter((m) => m.converted_from_prospect_id).length,
      imported: joined.filter((m) => m.imported_at).length,
      status,
      gender,
      departments,
      optedOut,
    };
  });
}

/** One row per member for the membership CSV. Phone numbers only when the role may see contacts. */
export function membershipCsv(db: Db, churchId: string, withContacts: boolean): (string | number)[][] {
  const statuses = memberStatuses(db, churchId);
  const depts = memberDepartmentsIndex(db, churchId);
  const header = ["First name", "Last name", ...(withContacts ? ["Phone"] : []), "Gender", "Joined", "Status", "Last attended", "Departments"];
  const rows = listMembers(db, churchId)
    .slice()
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))
    .map((m) => {
      const s = statuses.get(m.id)!;
      return [
        m.first_name,
        m.last_name,
        ...(withContacts ? [m.phone ?? ""] : []),
        m.gender ?? "",
        m.joined_on,
        s.status,
        s.last_attended ?? "",
        (depts.get(m.id) ?? []).map((d) => d.name).join("; "),
      ];
    });
  return [header, ...rows];
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

export interface ServiceReportRow {
  service: Service;
  members: number;
  guests: number;
  total: number;
}

export interface AttendanceReport {
  services: ServiceReportRow[];
  sundays: ServiceReportRow[];
  sundayAvg: number;
  sundayAvgMembers: number;
  sundayAvgGuests: number;
  midweekAvg: number | null;
  peak: ServiceReportRow | null;
  low: ServiceReportRow | null;
  uniqueMembers: number;
  memberCount: number;
}

export function attendanceReport(db: Db, churchId: string, range: DateRange): AttendanceReport {
  return memo(db, `rptAttendance:${churchId}:${rangeKey(range)}`, () => {
    const services = db.services
      .filter((s) => s.church_id === churchId && s.closed && inRange(parseISO(s.starts_at), range))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const ids = new Set(services.map((s) => s.id));
    const counts = new Map<string, number>();
    const unique = new Set<string>();
    for (const a of db.attendance) {
      if (!ids.has(a.service_id)) continue;
      counts.set(a.service_id, (counts.get(a.service_id) ?? 0) + 1);
      unique.add(a.member_id);
    }
    const rows = services.map((service) => {
      const members = counts.get(service.id) ?? 0;
      return { service, members, guests: service.guest_count, total: members + service.guest_count };
    });
    const sundays = rows.filter((r) => r.service.kind === "sunday");
    const midweek = rows.filter((r) => r.service.kind === "midweek");
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
    const peak = sundays.reduce<ServiceReportRow | null>((m, r) => (!m || r.total > m.total ? r : m), null);
    const low = sundays.reduce<ServiceReportRow | null>((m, r) => (!m || r.total < m.total ? r : m), null);
    return {
      services: rows,
      sundays,
      sundayAvg: avg(sundays.map((r) => r.total)),
      sundayAvgMembers: avg(sundays.map((r) => r.members)),
      sundayAvgGuests: avg(sundays.map((r) => r.guests)),
      midweekAvg: midweek.length ? avg(midweek.map((r) => r.total)) : null,
      peak,
      low,
      uniqueMembers: unique.size,
      memberCount: listMembers(db, churchId).filter((m) => m.joined_on <= format(range.to, "yyyy-MM-dd")).length,
    };
  });
}

export function attendanceCsv(report: AttendanceReport): (string | number)[][] {
  return [
    ["Date", "Time", "Service", "Type", "Location", "Members", "Guests", "Total"],
    ...report.services.map((r) => [
      format(parseISO(r.service.starts_at), "yyyy-MM-dd"),
      format(parseISO(r.service.starts_at), "HH:mm"),
      r.service.name,
      r.service.kind,
      r.service.location,
      r.members,
      r.guests,
      r.total,
    ]),
  ];
}

/* ------------------------------------------------------------------ */
/* Giving                                                              */
/* ------------------------------------------------------------------ */

export interface GivingReport {
  gross: CurrencyTotals;
  reversed: CurrencyTotals;
  net: CurrencyTotals;
  entries: Record<Currency, number>;
  reversals: Record<Currency, number>;
  byType: Record<GivingType, CurrencyTotals>;
  byBucket: { bucket: Bucket; totals: CurrencyTotals }[];
  /** Posted and reversal rows in the range, oldest first. */
  rows: GivingEntry[];
  pendingDrafts: number;
}

export function givingReport(db: Db, churchId: string, range: DateRange): GivingReport {
  return memo(db, `rptGiving:${churchId}:${rangeKey(range)}`, () => {
    const gross = emptyTotals();
    const reversed = emptyTotals();
    const entries = { LRD: 0, USD: 0 };
    const reversals = { LRD: 0, USD: 0 };
    const byType = Object.fromEntries(GIVING_TYPES.map((t) => [t, emptyTotals()])) as Record<GivingType, CurrencyTotals>;
    const buckets = rangeBuckets(range);
    const byBucket = buckets.map((bucket) => ({ bucket, totals: emptyTotals() }));
    const rows: GivingEntry[] = [];
    for (const e of db.giving_entries) {
      if (e.church_id !== churchId) continue;
      const d = parseISO(e.created_at);
      if (!inRange(d, range)) continue;
      rows.push(e);
      const sign = e.kind === "reversal" ? -1 : 1;
      if (e.kind === "reversal") {
        reversed[e.currency] += e.amount_minor;
        reversals[e.currency]++;
      } else {
        gross[e.currency] += e.amount_minor;
        entries[e.currency]++;
      }
      byType[e.type][e.currency] += sign * e.amount_minor;
      const i = bucketIndex(buckets, d);
      if (i >= 0) byBucket[i].totals[e.currency] += sign * e.amount_minor;
    }
    const net = emptyTotals();
    for (const c of CURRENCIES) net[c] = gross[c] - reversed[c];
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const pendingDrafts = db.giving_drafts.filter(
      (d) => d.church_id === churchId && d.status === "pending_review" && inRange(parseISO(d.created_at), range),
    ).length;
    return { gross, reversed, net, entries, reversals, byType, byBucket, rows, pendingDrafts };
  });
}
