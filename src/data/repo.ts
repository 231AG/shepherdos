"use client";

/**
 * Repository: the only way components read or write data.
 *
 * In this demo it merges the generated seed with the visitor's persisted
 * deltas. In the full build only this module changes: queries become
 * Supabase reads under RLS and commands become server actions/RPCs.
 */
import { endOfMonth, isWithinInterval, parseISO, startOfMonth, subDays } from "date-fns";
import { OPERATOR_NAME, type Tables } from "@/mock/seed";
import { randomUuid } from "@/mock/prng";
import { useDemoStore } from "./store";
import { addRow, memo, patchRow, type Db } from "./core";
import type {
  ChurchEvent,
  Church,
  Department,
  FollowUpTask,
  GivingType,
  Member,
  RoleId,
  Service,
  StaffUser,
} from "./types";
import { GIVING_TYPES } from "./types";
import { lastSunday, toISODate } from "@/lib/dates";
import { deriveStatus, type MemberStatus, type StatusResult } from "@/lib/status";
import { emptyTotals, type CurrencyTotals } from "@/lib/money";

/* ------------------------------------------------------------------ */
/* Churches, staff, personas, scope                                    */
/* ------------------------------------------------------------------ */

export function getChurchBySlug(db: Db, slug: string): Church | undefined {
  return db.churches.find((c) => c.slug === slug);
}

export function listDemoChurches(db: Db): Church[] {
  return db.churches.filter((c) => c.has_content);
}

export function listPlatformChurches(db: Db): Church[] {
  return db.churches;
}

export function listDepartments(db: Db, churchId: string): Department[] {
  return db.departments.filter((d) => d.church_id === churchId);
}

export interface Persona {
  name: string;
  display: string;
  title: string;
  initials: string;
  department: Department | null;
}

export function getPersona(db: Db, churchId: string | null, role: RoleId): Persona {
  if (role === "operator" || !churchId) {
    return { name: OPERATOR_NAME, display: OPERATOR_NAME, title: "Platform operator", initials: "AS", department: null };
  }
  const staff: StaffUser | undefined = db.staff.find((s) => s.church_id === churchId && s.role === role);
  const department = staff?.department_id ? db.departments.find((d) => d.id === staff.department_id) ?? null : null;
  const titles: Record<RoleId, string> = {
    pastor: "Pastor",
    secretary: "Secretary",
    treasurer: staff?.mfa ? "Treasurer · MFA on" : "Treasurer",
    dept_head: `${department?.name ?? "Department"} head`,
    operator: "Platform operator",
  };
  const name = staff?.name ?? "Demo user";
  const parts = name.split(" ");
  return {
    name,
    display: staff?.display_name ?? name,
    title: titles[role],
    initials: `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase(),
    department,
  };
}

/** What slice of the church a role sees. Department heads see one department. */
export type Scope = { kind: "church" } | { kind: "department"; department: Department };

export function getScope(db: Db, churchId: string, role: RoleId): Scope {
  if (role === "dept_head") {
    const dept = getPersona(db, churchId, role).department;
    if (dept) return { kind: "department", department: dept };
  }
  return { kind: "church" };
}

/** Member ids in scope, or null for the whole church. */
export function scopedMemberIds(db: Db, churchId: string, scope: Scope): Set<string> | null {
  if (scope.kind === "church") return null;
  return memo(db, `scope:${scope.department.id}`, () => {
    return new Set(
      db.member_departments.filter((md) => md.church_id === churchId && md.department_id === scope.department.id).map((md) => md.member_id),
    );
  });
}

/* ------------------------------------------------------------------ */
/* Members and status                                                  */
/* ------------------------------------------------------------------ */

export function listMembers(db: Db, churchId: string, scope: Scope = { kind: "church" }): Member[] {
  const ids = scopedMemberIds(db, churchId, scope);
  return db.members.filter((m) => m.church_id === churchId && (!ids || ids.has(m.id)));
}

export function serviceIndex(db: Db): Map<string, Service> {
  return memo(db, "svcIndex", () => new Map(db.services.map((s) => [s.id, s])));
}

/** Last attended service date per member (ISO date). */
export function lastAttendedIndex(db: Db, churchId: string): Map<string, string> {
  return memo(db, `lastAtt:${churchId}`, () => {
    const svc = serviceIndex(db);
    const todayIso = toISODate(db.now);
    const out = new Map<string, string>();
    for (const a of db.attendance) {
      if (a.church_id !== churchId) continue;
      const s = svc.get(a.service_id);
      if (!s) continue;
      // A check-in at the open (upcoming) service counts as attending today.
      const day = s.starts_at.slice(0, 10) > todayIso ? todayIso : s.starts_at.slice(0, 10);
      const cur = out.get(a.member_id);
      if (!cur || day > cur) out.set(a.member_id, day);
    }
    return out;
  });
}

export function memberStatuses(db: Db, churchId: string): Map<string, StatusResult> {
  return memo(db, `status:${churchId}`, () => {
    const church = db.churches.find((c) => c.id === churchId)!;
    const last = lastAttendedIndex(db, churchId);
    const windowStart = subDays(db.now, church.settings.inactive_weeks * 7);
    const hadServices = db.services.some(
      (s) => s.church_id === churchId && s.closed && parseISO(s.starts_at) >= windowStart,
    );
    const out = new Map<string, StatusResult>();
    for (const m of db.members) {
      if (m.church_id !== churchId) continue;
      out.set(m.id, deriveStatus(m, last.get(m.id) ?? null, church.settings, db.now, hadServices));
    }
    return out;
  });
}

export function statusCounts(db: Db, churchId: string, scope: Scope): Record<MemberStatus, number> {
  const statuses = memberStatuses(db, churchId);
  const counts: Record<MemberStatus, number> = { new: 0, active: 0, inactive: 0, excused: 0 };
  for (const m of listMembers(db, churchId, scope)) counts[statuses.get(m.id)!.status]++;
  return counts;
}

export function memberById(db: Db, id: string | null): Member | undefined {
  if (!id) return undefined;
  return memo(db, "memberIndex", () => new Map(db.members.map((m) => [m.id, m]))).get(id);
}

export function memberName(m: Pick<Member, "first_name" | "last_name"> | undefined): string {
  return m ? `${m.first_name} ${m.last_name}` : "";
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

export interface AttendancePoint {
  service: Service;
  members: number;
  guests: number;
  total: number;
}

/** Most recent N closed Sunday services, oldest first. */
export function sundaySeries(db: Db, churchId: string, weeks: number, scope: Scope): AttendancePoint[] {
  return memo(db, `sundays:${churchId}:${weeks}:${scope.kind === "church" ? "all" : scope.department.id}`, () => {
    const ids = scopedMemberIds(db, churchId, scope);
    const sundays = db.services
      .filter((s) => s.church_id === churchId && s.kind === "sunday" && s.closed)
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .slice(0, weeks)
      .reverse();
    const counts = new Map<string, number>();
    for (const a of db.attendance) {
      if (a.church_id !== churchId) continue;
      if (ids && !ids.has(a.member_id)) continue;
      counts.set(a.service_id, (counts.get(a.service_id) ?? 0) + 1);
    }
    return sundays.map((service) => {
      const members = counts.get(service.id) ?? 0;
      const guests = ids ? 0 : service.guest_count;
      return { service, members, guests, total: members + guests };
    });
  });
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  members: number;
  joinedThisMonth: number;
  avgAttendance: number;
  avgIncludesGuests: boolean;
  statusCounts: Record<MemberStatus, number>;
}

export function dashboardStats(db: Db, churchId: string, scope: Scope): DashboardStats {
  const members = listMembers(db, churchId, scope);
  const monthStart = startOfMonth(db.now);
  const joinedThisMonth = members.filter((m) => parseISO(m.joined_on) >= monthStart).length;
  const series = sundaySeries(db, churchId, 6, scope);
  const avg = series.length ? Math.round(series.reduce((s, p) => s + p.total, 0) / series.length) : 0;
  return {
    members: members.length,
    joinedThisMonth,
    avgAttendance: avg,
    avgIncludesGuests: scope.kind === "church",
    statusCounts: statusCounts(db, churchId, scope),
  };
}

/* ------------------------------------------------------------------ */
/* Giving (read side for Phase 1)                                      */
/* ------------------------------------------------------------------ */

export interface GivingSummary {
  /** Posted minus reversals, per currency. Never summed across currencies. */
  posted: CurrencyTotals;
  byType: Record<GivingType, CurrencyTotals>;
  entryCount: number;
  drafts: { count: number; totals: CurrencyTotals };
}

export function givingSummary(db: Db, churchId: string, range: { from: Date; to: Date }): GivingSummary {
  const posted = emptyTotals();
  const byType = Object.fromEntries(GIVING_TYPES.map((t) => [t, emptyTotals()])) as Record<GivingType, CurrencyTotals>;
  let entryCount = 0;
  for (const e of db.giving_entries) {
    if (e.church_id !== churchId) continue;
    if (!isWithinInterval(parseISO(e.created_at), { start: range.from, end: range.to })) continue;
    const sign = e.kind === "reversal" ? -1 : 1;
    posted[e.currency] += sign * e.amount_minor;
    byType[e.type][e.currency] += sign * e.amount_minor;
    if (e.kind === "posted") entryCount++;
  }
  const draftTotals = emptyTotals();
  let draftCount = 0;
  for (const d of db.giving_drafts) {
    if (d.church_id !== churchId || d.status !== "pending_review") continue;
    draftTotals[d.currency] += d.amount_minor;
    draftCount++;
  }
  return { posted, byType, entryCount, drafts: { count: draftCount, totals: draftTotals } };
}

export function monthRange(now: Date) {
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

/** Posted totals per Sunday for the last N weeks (by the Sunday's calendar week). */
export function weeklyGiving(db: Db, churchId: string, weeks: number): { week: Date; totals: CurrencyTotals }[] {
  return memo(db, `weeklyGiving:${churchId}:${weeks}`, () => {
    const end = lastSunday(subDays(db.now, 1));
    const buckets = Array.from({ length: weeks }, (_, i) => ({ week: subDays(end, (weeks - 1 - i) * 7), totals: emptyTotals() }));
    const first = subDays(buckets[0].week, 0);
    for (const e of db.giving_entries) {
      if (e.church_id !== churchId) continue;
      const d = parseISO(e.created_at);
      if (d < first) continue;
      const idx = Math.floor((d.getTime() - first.getTime()) / (7 * 86_400_000));
      if (idx < 0 || idx >= weeks) continue;
      buckets[idx].totals[e.currency] += (e.kind === "reversal" ? -1 : 1) * e.amount_minor;
    }
    return buckets;
  });
}

/* ------------------------------------------------------------------ */
/* Follow-up tasks and events                                          */
/* ------------------------------------------------------------------ */

export interface TaskView {
  task: FollowUpTask;
  name: string;
}

export function listOpenTasks(db: Db, churchId: string, scope: Scope): TaskView[] {
  const ids = scopedMemberIds(db, churchId, scope);
  return db.tasks
    .filter((t) => t.church_id === churchId && !t.done_at)
    .filter((t) => !ids || (t.member_id !== null && ids.has(t.member_id)))
    .sort((a, b) => a.due_on.localeCompare(b.due_on))
    .map((task) => {
      const p = task.prospect_id ? db.prospects.find((x) => x.id === task.prospect_id) : undefined;
      const m = memberById(db, task.member_id);
      return { task, name: p ? `${p.first_name} ${p.last_name}` : memberName(m) };
    });
}

export function upcomingEvents(db: Db, churchId: string, opts: { limit: number; departmentId?: string }): ChurchEvent[] {
  const nowIso = db.now.toISOString();
  return db.events
    .filter((e) => e.church_id === churchId && e.starts_at >= nowIso && !e.service_id)
    .filter((e) => !opts.departmentId || e.department_id === opts.departmentId || e.department_id === null)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, opts.limit);
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

/** Record a follow-up note and close the task. */
export function logFollowUpNote(task: FollowUpTask, note: string, authorName: string) {
  const now = new Date().toISOString();
  addRow("follow_up_events", {
    id: randomUuid(),
    church_id: task.church_id,
    prospect_id: task.prospect_id,
    member_id: task.member_id,
    note,
    author_name: authorName,
    created_at: now,
  });
  patchRow("tasks", task.id, { done_at: now });
}

export function resetDemo() {
  useDemoStore.getState().resetDemo();
}

/* ------------------------------------------------------------------ */
/* Platform console (operator)                                         */
/* ------------------------------------------------------------------ */

export function churchMemberCount(db: Db, church: Church): number | null {
  if (!church.has_content) return church.member_count_hint;
  return memo(db, `memberCount:${church.id}`, () => db.members.filter((m) => m.church_id === church.id).length);
}

export function smsBalance(db: Db, church: Church): number {
  if (!church.has_content) return church.sms_credits;
  return db.sms_wallet.filter((w) => w.church_id === church.id).reduce((s, w) => s + w.credits, 0);
}

export function listAuditEvents(db: Db): AuditEventView[] {
  return [...db.audit_events].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export type AuditEventView = Tables["audit_events"][number];

export function listSupportGrants(db: Db) {
  return [...db.support_grants].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** A grant is live while approved and not yet expired. */
export function isGrantLive(g: Tables["support_grants"][number], at: Date): boolean {
  return g.status === "approved" && !!g.expires_at && new Date(g.expires_at) > at;
}

function audit(churchId: string | null, actor: string, action: string) {
  addRow("audit_events", { id: randomUuid(), church_id: churchId, actor_name: actor, action, created_at: new Date().toISOString() });
}

export function endSupportGrant(grantId: string, churchName: string) {
  patchRow("support_grants", grantId, { status: "ended", expires_at: new Date().toISOString() });
  audit(null, OPERATOR_NAME, `Support access to ${churchName} ended early by A. Sumo.`);
}

export function provisionChurch(input: { name: string; city: string; county: string; adminName: string; adminPhone: string }) {
  const id = randomUuid();
  const words = input.name.split(/\s+/).filter(Boolean);
  addRow("churches", {
    id,
    slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    name: input.name,
    short_name: words.slice(0, 2).join(" "),
    initials: `${words[0]?.[0] ?? "C"}${words[1]?.[0] ?? ""}`.toUpperCase(),
    city: input.city,
    county: input.county,
    plan: "Annual",
    renewal_on: null,
    subscription_status: "onboarding",
    hosting_fee_minor: 85_000,
    sms_credits: 0,
    staff_count: 1,
    has_content: false,
    member_count_hint: null,
    settings: { new_days: 28, inactive_weeks: 6, pastor_giving_visibility: "totals" },
    created_at: new Date().toISOString(),
  });
  audit(id, OPERATOR_NAME, `Church provisioned: ${input.name}. Invite sent to ${input.adminName} (${input.adminPhone}).`);
}

export { useDb, type Db } from "./core";
export * from "./members";
export * from "./attendance";
export * from "./importer";
