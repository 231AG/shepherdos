"use client";

/**
 * Church settings: profile, member status thresholds, pastor giving visibility,
 * staff invitations and support access decisions. Re-exported by repo.ts.
 *
 * Status thresholds live on the church row. Member status is derived on read,
 * so saving new thresholds recalculates every status in the app at once.
 */
import { randomUuid } from "@/mock/prng";
import { addRow, currentDb, patchRow, removeRows, type Db } from "./core";
import type { Church, ChurchRole, ChurchSettings, StaffUser } from "./types";

function audit(churchId: string, actor: string, action: string) {
  addRow("audit_events", { id: randomUuid(), church_id: churchId, actor_name: actor, action, created_at: new Date().toISOString() });
}

export const THRESHOLD_LIMITS = {
  new_days: { min: 7, max: 90, default: 28 },
  inactive_weeks: { min: 2, max: 26, default: 6 },
} as const;

export interface ProfileInput {
  name: string;
  short_name: string;
  address: string;
  city: string;
  county: string;
  phone: string | null;
}

export function updateChurchProfile(church: Church, input: ProfileInput, actor: string) {
  const words = input.short_name.split(/\s+/).filter(Boolean);
  patchRow("churches", church.id, {
    name: input.name.trim(),
    short_name: input.short_name.trim(),
    initials: `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase() || church.initials,
    address: input.address.trim() || null,
    city: input.city.trim(),
    county: input.county,
    phone: input.phone,
  });
  audit(church.id, actor, `Church profile updated for ${input.short_name.trim()}.`);
}

export function updateChurchSettings(church: Church, patch: Partial<ChurchSettings>, actor: string) {
  const next = { ...church.settings, ...patch };
  patchRow("churches", church.id, { settings: next });
  const changes: string[] = [];
  if (patch.new_days !== undefined && patch.new_days !== church.settings.new_days) changes.push(`New for ${patch.new_days} days`);
  if (patch.inactive_weeks !== undefined && patch.inactive_weeks !== church.settings.inactive_weeks) changes.push(`inactive after ${patch.inactive_weeks} weeks`);
  if (patch.pastor_giving_visibility && patch.pastor_giving_visibility !== church.settings.pastor_giving_visibility) {
    changes.push(`pastor giving view set to ${VISIBILITY_LABEL[patch.pastor_giving_visibility].toLowerCase()}`);
  }
  if (changes.length) audit(church.id, actor, `Settings changed: ${changes.join(", ")}.`);
}

export const VISIBILITY_LABEL: Record<ChurchSettings["pastor_giving_visibility"], string> = {
  none: "No giving",
  totals: "Totals only",
  ledger: "Full ledger",
};

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

export function listStaff(db: Db, churchId: string): StaffUser[] {
  const order: Record<ChurchRole, number> = { pastor: 0, secretary: 1, treasurer: 2, dept_head: 3 };
  return db.staff
    .filter((s) => s.church_id === churchId)
    .sort((a, b) => (a.status === b.status ? order[a.role] - order[b.role] || a.name.localeCompare(b.name) : a.status === "active" ? -1 : 1));
}

export interface InviteInput {
  church: Church;
  name: string;
  phone: string;
  role: ChurchRole;
  departmentId: string | null;
  invitedBy: string;
}

export type InviteResult = { ok: true; staff: StaffUser } | { ok: false; error: string };

/** Simulated invitation: the full build sends a one-time sign-in link by SMS. */
export function inviteStaff(input: InviteInput): InviteResult {
  const db = currentDb();
  if (db.staff.some((s) => s.church_id === input.church.id && s.phone === input.phone)) {
    return { ok: false, error: "Someone on the staff list already uses this phone number." };
  }
  const staff: StaffUser = {
    id: randomUuid(),
    church_id: input.church.id,
    name: input.name.trim(),
    display_name: input.name.trim(),
    role: input.role,
    department_id: input.role === "dept_head" ? input.departmentId : null,
    mfa: false,
    phone: input.phone,
    status: "invited",
    created_at: new Date().toISOString(),
  };
  addRow("staff", staff);
  audit(input.church.id, input.invitedBy, `${staff.name} invited as ${ROLE_NAME[input.role].toLowerCase()}.`);
  return { ok: true, staff };
}

export function cancelInvite(staff: StaffUser, church: Church, actor: string) {
  removeRows("staff", [staff.id]);
  audit(church.id, actor, `Invitation for ${staff.name} cancelled.`);
}

export const ROLE_NAME: Record<ChurchRole, string> = {
  pastor: "Pastor",
  secretary: "Secretary",
  treasurer: "Treasurer",
  dept_head: "Department head",
};

/* ------------------------------------------------------------------ */
/* Support access (church side)                                        */
/* ------------------------------------------------------------------ */

export function churchSupportGrants(db: Db, churchId: string) {
  return db.support_grants.filter((g) => g.church_id === churchId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** The church ends a live grant before it expires. */
export function revokeSupportGrant(grantId: string, church: Church, actor: string) {
  patchRow("support_grants", grantId, { status: "ended", expires_at: new Date().toISOString() });
  audit(church.id, actor, `Support access for ComNet ended early by ${church.short_name}.`);
}
