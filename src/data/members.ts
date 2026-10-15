"use client";

/** Members: directory, profile, create and edit. Re-exported by repo.ts. */
import { startOfYear } from "date-fns";
import { randomUuid } from "@/mock/prng";
import { emptyTotals, type CurrencyTotals } from "@/lib/money";
import { phoneMatches } from "@/lib/phone";
import type { MemberStatus, StatusResult } from "@/lib/status";
import { addRow, addRows, currentDb, memo, patchRow, removeRows, type Db } from "./core";
import { listMembers, memberStatuses, serviceIndex, type Scope } from "./repo";
import type { Department, FollowUpEvent, GivingEntry, Member, MemberException, Prospect, Service } from "./types";

export interface MemberRow {
  member: Member;
  status: StatusResult;
  departments: Department[];
}

/** Departments per member, sorted by department name. */
export function memberDepartmentsIndex(db: Db, churchId: string): Map<string, Department[]> {
  return memo(db, `memberDepts:${churchId}`, () => {
    const depts = new Map(db.departments.filter((d) => d.church_id === churchId).map((d) => [d.id, d]));
    const out = new Map<string, Department[]>();
    for (const md of db.member_departments) {
      if (md.church_id !== churchId) continue;
      const d = depts.get(md.department_id);
      if (!d) continue;
      const list = out.get(md.member_id) ?? [];
      list.push(d);
      out.set(md.member_id, list);
    }
    for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  });
}

export function matchesMemberQuery(m: Member, q: string, allowPhone: boolean): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const name = `${m.first_name} ${m.last_name}`.toLowerCase();
  if (query.split(/\s+/).every((part) => name.includes(part))) return true;
  return allowPhone && phoneMatches(m.phone, query);
}

export interface MemberFilter {
  q: string;
  status: MemberStatus | "all";
  departmentId: string | "all";
  /** Treasurers cannot look members up by phone number. */
  allowPhoneSearch: boolean;
}

export function listMemberRows(db: Db, churchId: string, scope: Scope, f: MemberFilter): MemberRow[] {
  const statuses = memberStatuses(db, churchId);
  const depts = memberDepartmentsIndex(db, churchId);
  return listMembers(db, churchId, scope)
    .filter((m) => matchesMemberQuery(m, f.q, f.allowPhoneSearch))
    .map((member) => ({ member, status: statuses.get(member.id)!, departments: depts.get(member.id) ?? [] }))
    .filter((r) => f.status === "all" || r.status.status === f.status)
    .filter((r) => f.departmentId === "all" || (f.departmentId === "none" ? r.departments.length === 0 : r.departments.some((d) => d.id === f.departmentId)))
    .sort((a, b) => a.member.first_name.localeCompare(b.member.first_name) || a.member.last_name.localeCompare(b.member.last_name));
}

export function departmentMemberCounts(db: Db, churchId: string): Map<string, number> {
  return memo(db, `deptCounts:${churchId}`, () => {
    const out = new Map<string, number>();
    for (const md of db.member_departments) if (md.church_id === churchId) out.set(md.department_id, (out.get(md.department_id) ?? 0) + 1);
    return out;
  });
}

/** Attendance at the last N closed Sundays, oldest first. */
export function memberAttendanceHistory(db: Db, member: Member, weeks = 12): { service: Service; attended: boolean; beforeJoin: boolean }[] {
  const sundays = db.services
    .filter((s) => s.church_id === member.church_id && s.kind === "sunday" && s.closed)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .slice(0, weeks)
    .reverse();
  const attended = new Set(db.attendance.filter((a) => a.member_id === member.id).map((a) => a.service_id));
  return sundays.map((service) => ({
    service,
    attended: attended.has(service.id),
    beforeJoin: service.starts_at.slice(0, 10) < member.joined_on,
  }));
}

/** Most recent services this member attended, newest first. */
export function memberRecentAttendance(db: Db, member: Member, limit = 6): Service[] {
  const svc = serviceIndex(db);
  return db.attendance
    .filter((a) => a.member_id === member.id)
    .map((a) => svc.get(a.service_id))
    .filter((s): s is Service => !!s)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .slice(0, limit);
}

export interface MemberGiving {
  yearTotals: CurrencyTotals;
  count: number;
  last: GivingEntry | null;
}

/** This year's giving for one member, per currency (posted minus reversals). */
export function memberGivingSummary(db: Db, memberId: string): MemberGiving {
  const from = startOfYear(db.now).toISOString();
  const yearTotals = emptyTotals();
  let count = 0;
  let last: GivingEntry | null = null;
  for (const e of db.giving_entries) {
    if (e.member_id !== memberId || e.created_at < from) continue;
    yearTotals[e.currency] += (e.kind === "reversal" ? -1 : 1) * e.amount_minor;
    if (e.kind === "posted") {
      count++;
      if (!last || e.created_at > last.created_at) last = e;
    }
  }
  return { yearTotals, count, last };
}

/** Soul-winning history for a member who was converted from a prospect. */
export function memberProspectHistory(db: Db, member: Member): { prospect: Prospect; events: FollowUpEvent[] } | null {
  const prospect = member.converted_from_prospect_id
    ? db.prospects.find((p) => p.id === member.converted_from_prospect_id)
    : db.prospects.find((p) => p.converted_member_id === member.id);
  if (!prospect) return null;
  const events = db.follow_up_events
    .filter((e) => e.prospect_id === prospect.id || e.member_id === member.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { prospect, events };
}

export function findMemberByPhone(db: Db, churchId: string, e164: string, exceptId?: string): Member | undefined {
  return db.members.find((m) => m.church_id === churchId && m.phone === e164 && m.id !== exceptId);
}

export interface MemberInput {
  first_name: string;
  last_name: string;
  phone: string | null;
  gender: Member["gender"];
  joined_on: string;
  household: string | null;
  exception: MemberException | null;
  sms_opt_out: boolean;
  department_ids: string[];
}

export function createMember(churchId: string, input: MemberInput): Member {
  const now = new Date().toISOString();
  const { department_ids, ...fields } = input;
  const member: Member = {
    id: randomUuid(),
    church_id: churchId,
    ...fields,
    converted_from_prospect_id: null,
    imported_at: null,
    created_at: now,
  };
  addRow("members", member);
  addRows(
    "member_departments",
    department_ids.map((department_id) => ({ id: randomUuid(), church_id: churchId, member_id: member.id, department_id, created_at: now })),
  );
  return member;
}

export function updateMember(member: Member, input: MemberInput) {
  const { department_ids, ...fields } = input;
  patchRow("members", member.id, fields);
  setMemberDepartments(member, department_ids);
}

export function setMemberDepartments(member: Member, departmentIds: string[]) {
  const db = currentDb();
  const current = db.member_departments.filter((md) => md.member_id === member.id);
  const want = new Set(departmentIds);
  removeRows("member_departments", current.filter((md) => !want.has(md.department_id)).map((md) => md.id));
  const have = new Set(current.map((md) => md.department_id));
  const now = new Date().toISOString();
  addRows(
    "member_departments",
    departmentIds
      .filter((id) => !have.has(id))
      .map((department_id) => ({ id: randomUuid(), church_id: member.church_id, member_id: member.id, department_id, created_at: now })),
  );
}
