"use client";

/** Services, Sunday check-in, the offline queue and attendance trends. Re-exported by repo.ts. */
import { subDays } from "date-fns";
import { randomUuid } from "@/mock/prng";
import { useDemoStore } from "./store";
import { addRow, currentDb, memo, patchRow, patchRows, removeRows, type Db } from "./core";
import { listDepartments, scopedMemberIds, sundaySeries, type Scope } from "./repo";
import type { AttendanceRecord, Service, ServiceKind } from "./types";

export interface ServiceRow {
  service: Service;
  members: number;
  guests: number;
  total: number;
}

function countsByService(db: Db, churchId: string, scope: Scope): Map<string, number> {
  const ids = scopedMemberIds(db, churchId, scope);
  return memo(db, `svcCounts:${churchId}:${scope.kind === "church" ? "all" : scope.department.id}`, () => {
    const out = new Map<string, number>();
    for (const a of db.attendance) {
      if (a.church_id !== churchId || (ids && !ids.has(a.member_id))) continue;
      out.set(a.service_id, (out.get(a.service_id) ?? 0) + 1);
    }
    return out;
  });
}

/** Open services first (soonest first), then closed services, newest first. */
export function listServices(db: Db, churchId: string, scope: Scope): ServiceRow[] {
  const counts = countsByService(db, churchId, scope);
  const guestsVisible = scope.kind === "church";
  return db.services
    .filter((s) => s.church_id === churchId)
    .sort((a, b) => (a.closed === b.closed ? (a.closed ? b.starts_at.localeCompare(a.starts_at) : a.starts_at.localeCompare(b.starts_at)) : a.closed ? 1 : -1))
    .map((service) => {
      const members = counts.get(service.id) ?? 0;
      const guests = guestsVisible ? service.guest_count : 0;
      return { service, members, guests, total: members + guests };
    });
}

export function getService(db: Db, id: string | null): Service | undefined {
  return id ? db.services.find((s) => s.id === id) : undefined;
}

/** The service check-in opens on by default: the open Sunday service. */
export function defaultCheckInService(db: Db, churchId: string): Service | undefined {
  const open = db.services.filter((s) => s.church_id === churchId && !s.closed).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return open.find((s) => s.kind === "sunday") ?? open[0];
}

export function serviceAttendance(db: Db, serviceId: string): Map<string, AttendanceRecord> {
  return memo(db, `svcAtt:${serviceId}`, () => new Map(db.attendance.filter((a) => a.service_id === serviceId).map((a) => [a.member_id, a])));
}

export type CheckInResult = { ok: true; record: AttendanceRecord } | { ok: false; reason: "already" | "closed"; record?: AttendanceRecord };

/**
 * Check a member in. One record per member per service (duplicates are
 * refused). Offline check-ins are saved on the device as "pending".
 */
export function checkIn(service: Service, memberId: string, online: boolean): CheckInResult {
  if (service.closed) return { ok: false, reason: "closed" };
  const existing = serviceAttendance(currentDb(), service.id).get(memberId);
  if (existing) return { ok: false, reason: "already", record: existing };
  const now = new Date().toISOString();
  const record: AttendanceRecord = {
    id: randomUuid(),
    church_id: service.church_id,
    service_id: service.id,
    member_id: memberId,
    checked_in_at: now,
    sync_state: online ? "synced" : "pending",
    sync_error: null,
    device: "This device",
    created_at: now,
  };
  addRow("attendance", record);
  return { ok: true, record };
}

export function undoCheckIn(recordId: string) {
  removeRows("attendance", [recordId]);
}

export function setGuestCount(serviceId: string, count: number) {
  patchRow("services", serviceId, { guest_count: Math.max(0, count) });
}

export interface ServiceInput {
  church_id: string;
  kind: ServiceKind;
  name: string;
  starts_at: string;
  location: string;
}

export function createService(input: ServiceInput): Service {
  const service: Service = { id: randomUuid(), ...input, guest_count: 0, closed: false, created_at: new Date().toISOString() };
  addRow("services", service);
  return service;
}

export function closeService(serviceId: string) {
  patchRow("services", serviceId, { closed: true });
}

/* ------------------------------------------------------------------ */
/* Offline queue                                                       */
/* ------------------------------------------------------------------ */

/** Items saved on this device that have not reached the (simulated) server. */
export function pendingSyncCount(db: Db, churchId: string): number {
  let n = 0;
  for (const a of db.attendance) if (a.church_id === churchId && a.sync_state !== "synced") n++;
  for (const d of db.giving_drafts) if (d.church_id === churchId && d.sync_state !== "synced") n++;
  return n;
}

const SYNC_MS = 1400;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function finishSync(attendanceIds: string[], draftIds: string[]) {
  const done = { sync_state: "synced" as const, sync_error: null };
  patchRows("attendance", Object.fromEntries(attendanceIds.map((id) => [id, done])));
  patchRows("giving_drafts", Object.fromEntries(draftIds.map((id) => [id, { sync_state: "synced" as const }])));
  useDemoStore.getState().setSyncing([]);
  syncTimer = null;
}

/**
 * Replay the offline queue: pending items show "Syncing" briefly, then become
 * synced. Items already in error stay in error until the visitor taps Retry.
 */
export function syncNow(): { total: number } {
  if (!useDemoStore.getState().online || syncTimer) return { total: 0 };
  const db = currentDb();
  const attendanceIds = db.attendance.filter((a) => a.sync_state === "pending").map((a) => a.id);
  const draftIds = db.giving_drafts.filter((d) => d.sync_state === "pending").map((d) => d.id);
  const total = attendanceIds.length + draftIds.length;
  if (!total) return { total: 0 };
  useDemoStore.getState().setSyncing([...attendanceIds, ...draftIds]);
  syncTimer = setTimeout(() => finishSync(attendanceIds, draftIds), SYNC_MS);
  return { total };
}

/** Retry a failed item. Succeeds when online. */
export function retrySync(recordId: string): boolean {
  if (!useDemoStore.getState().online) return false;
  useDemoStore.getState().setSyncing([...useDemoStore.getState().syncing, recordId]);
  setTimeout(() => {
    patchRow("attendance", recordId, { sync_state: "synced", sync_error: null });
    useDemoStore.getState().setSyncing(useDemoStore.getState().syncing.filter((id) => id !== recordId));
  }, SYNC_MS);
  return true;
}

/* ------------------------------------------------------------------ */
/* Trends                                                              */
/* ------------------------------------------------------------------ */

export interface AttendanceTrends {
  avg6: number;
  prev6: number;
  changePct: number | null;
  guestsAvg6: number;
  midweekAvg6: number;
  departments: { id: string; name: string; members: number; present: number }[];
  lastSunday: Service | null;
}

export function attendanceTrends(db: Db, churchId: string, scope: Scope): AttendanceTrends {
  const series = sundaySeries(db, churchId, 12, scope);
  const recent = series.slice(-6);
  const prev = series.slice(0, 6);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const avg6 = avg(recent.map((p) => p.total));
  const prev6 = avg(prev.map((p) => p.total));
  const ids = scopedMemberIds(db, churchId, scope);
  const since = subDays(db.now, 42).toISOString();
  const counts = countsByService(db, churchId, scope);
  const midweek = db.services.filter((s) => s.church_id === churchId && s.kind === "midweek" && s.closed && s.starts_at >= since);
  const lastSundayPoint = series[series.length - 1];
  const lastSundayService = lastSundayPoint?.service ?? null;
  const present = new Set(lastSundayService ? db.attendance.filter((a) => a.service_id === lastSundayService.id).map((a) => a.member_id) : []);
  const departments = listDepartments(db, churchId)
    .filter((d) => scope.kind === "church" || d.id === scope.department.id)
    .map((d) => {
      const memberIds = db.member_departments.filter((md) => md.department_id === d.id).map((md) => md.member_id);
      return { id: d.id, name: d.name, members: memberIds.length, present: memberIds.filter((id) => present.has(id)).length };
    })
    .sort((a, b) => b.present / Math.max(1, b.members) - a.present / Math.max(1, a.members));
  return {
    avg6,
    prev6,
    changePct: prev6 ? Math.round(((avg6 - prev6) / prev6) * 1000) / 10 : null,
    guestsAvg6: ids ? 0 : avg(recent.map((p) => p.guests)),
    midweekAvg6: avg(midweek.map((s) => (counts.get(s.id) ?? 0) + (ids ? 0 : s.guest_count))),
    departments,
    lastSunday: lastSundayService,
  };
}
