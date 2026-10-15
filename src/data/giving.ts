"use client";

/**
 * Giving: append-only ledger, reversals, offline drafts and daily close.
 * Re-exported by repo.ts.
 *
 * Rules enforced here (mirroring the spec's database invariants):
 * - Posted entries are never edited or deleted. A correction is a separate
 *   `reversal` row that points at the original, with a required reason.
 * - An entry can be reversed once.
 * - Nothing can be posted or reversed into a closed day.
 * - A day cannot be closed while drafts for it are waiting for review.
 * - Drafts never count in posted totals. LRD and USD are never summed.
 */
import { randomUuid } from "@/mock/prng";
import { emptyTotals, type CurrencyTotals } from "@/lib/money";
import { addRow, currentDb, memo, patchRow, type Db } from "./core";
import type { Currency, GivingDraft, GivingEntry, GivingType, Service } from "./types";

export type LedgerStatus = "posted" | "reversed" | "reversal" | "draft" | "draft_synced";

export interface LedgerRow {
  kind: "entry" | "draft";
  id: string;
  ref: string;
  created_at: string;
  member_id: string | null;
  giver_label: string | null;
  type: GivingType;
  currency: Currency;
  amount_minor: number;
  status: LedgerStatus;
  /** For a reversed entry, the reversal's ref. For a reversal, the original's ref. */
  linkedRef: string | null;
  reason: string | null;
  actor: string;
  entry?: GivingEntry;
  draft?: GivingDraft;
  /** Ref of a posted entry this draft may duplicate. */
  possibleDuplicateOf?: string | null;
}

export function serviceDay(s: Pick<Service, "starts_at">): string {
  return s.starts_at.slice(0, 10);
}

/** Services the treasurer can pick in the ledger: open services and recent ones with giving. */
export function givingServices(db: Db, churchId: string, limit = 12): Service[] {
  return memo(db, `givingServices:${churchId}:${limit}`, () => {
    const withGiving = new Set(db.giving_entries.filter((e) => e.church_id === churchId).map((e) => e.service_id));
    for (const d of db.giving_drafts) if (d.church_id === churchId) withGiving.add(d.service_id);
    const open = db.services.filter((s) => s.church_id === churchId && !s.closed);
    const past = db.services
      .filter((s) => s.church_id === churchId && s.closed && withGiving.has(s.id))
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .slice(0, limit);
    return [...open.sort((a, b) => a.starts_at.localeCompare(b.starts_at)), ...past];
  });
}

export function dayClose(db: Db, churchId: string, day: string) {
  return db.day_closes.find((c) => c.church_id === churchId && c.day === day);
}

/** Default ledger: the most recent service whose day is still open, else the next open service. */
export function defaultGivingService(db: Db, churchId: string): Service | undefined {
  const list = givingServices(db, churchId);
  const pastOpen = list.filter((s) => s.closed && !dayClose(db, churchId, serviceDay(s)));
  return pastOpen[0] ?? list.find((s) => !s.closed && s.kind === "sunday") ?? list[0];
}

function refIndex(db: Db): Map<string, GivingEntry> {
  return memo(db, "givingById", () => new Map(db.giving_entries.map((e) => [e.id, e])));
}

function reversalOf(db: Db): Map<string, GivingEntry> {
  return memo(db, "reversalOf", () => new Map(db.giving_entries.filter((e) => e.kind === "reversal" && e.reverses_id).map((e) => [e.reverses_id!, e])));
}

export function isReversed(db: Db, entryId: string): boolean {
  return reversalOf(db).has(entryId);
}

const TEN_MIN = 10 * 60 * 1000;

/** A draft that matches a posted entry (same member, amount and currency within 10 minutes). */
export function possibleDuplicate(db: Db, d: GivingDraft): GivingEntry | null {
  if (!d.member_id) return null;
  const t = new Date(d.created_at).getTime();
  return (
    db.giving_entries.find(
      (e) =>
        e.kind === "posted" &&
        e.church_id === d.church_id &&
        e.member_id === d.member_id &&
        e.currency === d.currency &&
        e.amount_minor === d.amount_minor &&
        Math.abs(new Date(e.created_at).getTime() - t) <= TEN_MIN,
    ) ?? null
  );
}

export function ledgerForService(db: Db, churchId: string, serviceId: string): LedgerRow[] {
  const byId = refIndex(db);
  const reversals = reversalOf(db);
  const rows: LedgerRow[] = db.giving_entries
    .filter((e) => e.church_id === churchId && e.service_id === serviceId)
    .map((e) => {
      const rev = reversals.get(e.id);
      return {
        kind: "entry" as const,
        id: e.id,
        ref: e.ref,
        created_at: e.created_at,
        member_id: e.member_id,
        giver_label: e.giver_label,
        type: e.type,
        currency: e.currency,
        amount_minor: e.amount_minor,
        status: e.kind === "reversal" ? ("reversal" as const) : rev ? ("reversed" as const) : ("posted" as const),
        linkedRef: e.kind === "reversal" ? (byId.get(e.reverses_id!)?.ref ?? null) : (rev?.ref ?? null),
        reason: e.reason,
        actor: e.actor_name,
        entry: e,
      };
    });
  for (const d of db.giving_drafts) {
    if (d.church_id !== churchId || d.service_id !== serviceId || d.status !== "pending_review") continue;
    rows.push({
      kind: "draft",
      id: d.id,
      ref: d.ref,
      created_at: d.created_at,
      member_id: d.member_id,
      giver_label: d.giver_label,
      type: d.type,
      currency: d.currency,
      amount_minor: d.amount_minor,
      status: d.sync_state === "synced" ? "draft_synced" : "draft",
      linkedRef: null,
      reason: null,
      actor: d.captured_by,
      draft: d,
      possibleDuplicateOf: possibleDuplicate(db, d)?.ref ?? null,
    });
  }
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export interface ServiceGivingTotals {
  posted: CurrencyTotals;
  drafts: CurrencyTotals;
  draftCount: number;
  entryCount: number;
}

/** Totals for one service: posted minus reversals, per currency; drafts separately. */
export function serviceGivingTotals(db: Db, churchId: string, serviceId: string): ServiceGivingTotals {
  const posted = emptyTotals();
  const drafts = emptyTotals();
  let draftCount = 0;
  let entryCount = 0;
  for (const e of db.giving_entries) {
    if (e.church_id !== churchId || e.service_id !== serviceId) continue;
    posted[e.currency] += (e.kind === "reversal" ? -1 : 1) * e.amount_minor;
    if (e.kind === "posted") entryCount++;
  }
  for (const d of db.giving_drafts) {
    if (d.church_id !== churchId || d.service_id !== serviceId || d.status !== "pending_review") continue;
    drafts[d.currency] += d.amount_minor;
    draftCount++;
  }
  return { posted, drafts, draftCount, entryCount };
}

/** Drafts waiting for review for a given calendar day (all services that day). */
export function pendingDraftsForDay(db: Db, churchId: string, day: string): GivingDraft[] {
  const services = new Set(db.services.filter((s) => s.church_id === churchId && serviceDay(s) === day).map((s) => s.id));
  return db.giving_drafts.filter((d) => d.church_id === churchId && d.status === "pending_review" && d.service_id !== null && services.has(d.service_id));
}

export function allPendingDrafts(db: Db, churchId: string): GivingDraft[] {
  return db.giving_drafts.filter((d) => d.church_id === churchId && d.status === "pending_review");
}

function nextRef(db: Db, churchId: string, prefix: "GV" | "REV" | "DR"): string {
  const source = prefix === "DR" ? db.giving_drafts : db.giving_entries;
  let max = 0;
  for (const r of source) {
    if (r.church_id !== churchId || !r.ref.startsWith(`${prefix}-`)) continue;
    max = Math.max(max, Number(r.ref.slice(prefix.length + 1)) || 0);
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export interface GivingInput {
  church_id: string;
  service: Service;
  member_id: string | null;
  giver_label: string | null;
  type: GivingType;
  currency: Currency;
  amount_minor: number;
}

export type GivingResult<T> = { ok: true; value: T } | { ok: false; error: string };

function closedDayError(db: Db, churchId: string, service: Service): string | null {
  const close = dayClose(db, churchId, serviceDay(service));
  return close ? `This day was closed by ${close.closed_by}. Nothing more can be posted to it.` : null;
}

export function postGiving(input: GivingInput, actor: string): GivingResult<GivingEntry> {
  const db = currentDb();
  if (input.amount_minor <= 0) return { ok: false, error: "Enter an amount greater than zero." };
  const closed = closedDayError(db, input.church_id, input.service);
  if (closed) return { ok: false, error: closed };
  const entry: GivingEntry = {
    id: randomUuid(),
    church_id: input.church_id,
    ref: nextRef(db, input.church_id, "GV"),
    kind: "posted",
    service_id: input.service.id,
    member_id: input.member_id,
    giver_label: input.giver_label,
    type: input.type,
    currency: input.currency,
    amount_minor: input.amount_minor,
    reverses_id: null,
    reason: null,
    actor_name: actor,
    created_at: new Date().toISOString(),
  };
  addRow("giving_entries", entry);
  return { ok: true, value: entry };
}

/** Save a draft (always allowed, also offline). Drafts need treasurer review before they count. */
export function saveGivingDraft(input: GivingInput, capturedBy: string, online: boolean): GivingResult<GivingDraft> {
  const db = currentDb();
  if (input.amount_minor <= 0) return { ok: false, error: "Enter an amount greater than zero." };
  const closed = closedDayError(db, input.church_id, input.service);
  if (closed) return { ok: false, error: closed };
  const draft: GivingDraft = {
    id: randomUuid(),
    church_id: input.church_id,
    ref: nextRef(db, input.church_id, "DR"),
    service_id: input.service.id,
    member_id: input.member_id,
    giver_label: input.giver_label,
    type: input.type,
    currency: input.currency,
    amount_minor: input.amount_minor,
    device: "This device",
    captured_by: capturedBy,
    status: "pending_review",
    sync_state: online ? "synced" : "pending",
    created_at: new Date().toISOString(),
  };
  addRow("giving_drafts", draft);
  return { ok: true, value: draft };
}

/** Post a correction: a compensating row linked to the original. The original is never changed. */
export function reverseGiving(entry: GivingEntry, reason: string, actor: string): GivingResult<GivingEntry> {
  const db = currentDb();
  if (entry.kind !== "posted") return { ok: false, error: "Only posted entries can be reversed." };
  if (isReversed(db, entry.id)) return { ok: false, error: `${entry.ref} has already been reversed.` };
  if (reason.trim().length < 3) return { ok: false, error: "A reason is required for every reversal." };
  const service = db.services.find((s) => s.id === entry.service_id);
  if (service) {
    const closed = closedDayError(db, entry.church_id, service);
    if (closed) return { ok: false, error: closed };
  }
  const reversal: GivingEntry = {
    ...entry,
    id: randomUuid(),
    ref: nextRef(db, entry.church_id, "REV"),
    kind: "reversal",
    reverses_id: entry.id,
    reason: reason.trim(),
    actor_name: actor,
    created_at: new Date().toISOString(),
  };
  addRow("giving_entries", reversal);
  return { ok: true, value: reversal };
}

/** Treasurer review: post a draft as a ledger entry. */
export function postDraft(draft: GivingDraft, actor: string): GivingResult<GivingEntry> {
  const db = currentDb();
  if (draft.status !== "pending_review") return { ok: false, error: "This draft was already reviewed." };
  if (draft.sync_state !== "synced") return { ok: false, error: "This draft hasn't synced from the device yet. Go online first." };
  const service = db.services.find((s) => s.id === draft.service_id);
  if (!service) return { ok: false, error: "The service for this draft no longer exists." };
  const result = postGiving(
    {
      church_id: draft.church_id,
      service,
      member_id: draft.member_id,
      giver_label: draft.giver_label,
      type: draft.type,
      currency: draft.currency,
      amount_minor: draft.amount_minor,
    },
    actor,
  );
  if (result.ok) patchRow("giving_drafts", draft.id, { status: "posted" });
  return result;
}

export function discardDraft(draft: GivingDraft) {
  patchRow("giving_drafts", draft.id, { status: "discarded" });
}

export function closeDay(churchId: string, day: string, actor: string): GivingResult<string> {
  const db = currentDb();
  if (dayClose(db, churchId, day)) return { ok: false, error: "This day is already closed." };
  const pending = pendingDraftsForDay(db, churchId, day);
  if (pending.length) return { ok: false, error: `${pending.length} draft${pending.length === 1 ? "" : "s"} must be reviewed before close.` };
  addRow("day_closes", { id: randomUuid(), church_id: churchId, day, closed_by: actor, created_at: new Date().toISOString() });
  return { ok: true, value: day };
}

export function lastServicesTotals(db: Db, churchId: string, limit = 8): { service: Service; totals: ServiceGivingTotals; closed: boolean }[] {
  return givingServices(db, churchId, limit)
    .filter((s) => s.closed)
    .map((service) => ({ service, totals: serviceGivingTotals(db, churchId, service.id), closed: !!dayClose(db, churchId, serviceDay(service)) }));
}
