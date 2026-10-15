"use client";

/**
 * Messaging: audiences, credit wallet and simulated delivery.
 * Re-exported by repo.ts. No SMS is ever sent: delivery is simulated.
 *
 * Credits follow the spec's wallet model: sending captures credits for every
 * recipient and segment; credits for messages that fail are released back.
 * The wallet can never go below zero.
 */
import { randomUuid, Rng } from "@/mock/prng";
import { useDemoStore } from "./store";
import { addRow, currentDb, memo, patchRow, type Db } from "./core";
import { listMembers, memberStatuses } from "./repo";
import type { Member, Message } from "./types";
import type { MemberStatus } from "@/lib/status";

export type Audience =
  | { kind: "all" }
  | { kind: "department"; departmentId: string }
  | { kind: "status"; status: MemberStatus }
  | { kind: "picked"; memberIds: string[] };

export interface ResolvedAudience {
  label: string;
  recipients: Member[];
  optedOut: number;
  noPhone: number;
}

export function resolveAudience(db: Db, churchId: string, a: Audience): ResolvedAudience {
  let pool: Member[];
  let label: string;
  if (a.kind === "all") {
    pool = listMembers(db, churchId);
    label = "All members";
  } else if (a.kind === "department") {
    const ids = new Set(db.member_departments.filter((md) => md.department_id === a.departmentId).map((md) => md.member_id));
    pool = listMembers(db, churchId).filter((m) => ids.has(m.id));
    label = db.departments.find((d) => d.id === a.departmentId)?.name ?? "Department";
  } else if (a.kind === "status") {
    const statuses = memberStatuses(db, churchId);
    pool = listMembers(db, churchId).filter((m) => statuses.get(m.id)?.status === a.status);
    label = `${a.status[0].toUpperCase()}${a.status.slice(1)} members`;
  } else {
    const ids = new Set(a.memberIds);
    pool = listMembers(db, churchId).filter((m) => ids.has(m.id));
    label = `${pool.length} chosen member${pool.length === 1 ? "" : "s"}`;
  }
  const optedOut = pool.filter((m) => m.sms_opt_out).length;
  const noPhone = pool.filter((m) => !m.sms_opt_out && !m.phone).length;
  return { label, recipients: pool.filter((m) => !m.sms_opt_out && m.phone), optedOut, noPhone };
}

export function walletBalance(db: Db, churchId: string): number {
  return memo(db, `wallet:${churchId}`, () => db.sms_wallet.filter((w) => w.church_id === churchId).reduce((s, w) => s + w.credits, 0));
}

export function walletHistory(db: Db, churchId: string) {
  return db.sms_wallet.filter((w) => w.church_id === churchId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listMessages(db: Db, churchId: string): Message[] {
  return db.messages.filter((m) => m.church_id === churchId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Sender ID shown on members' phones (alphanumeric, max 11 characters). */
export function senderId(churchName: string): string {
  return churchName
    .replace(/church|assembly|of|the/gi, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 11);
}

export type SendResult = { ok: true; message: Message } | { ok: false; error: string };

const STEP_MS = 1100;

function failuresFor(id: string, n: number): number {
  // Deterministic small failure rate (2-5%), at least 1 for 20+ recipients.
  const rng = new Rng(`fail:${id}`);
  return n < 20 ? 0 : Math.max(1, Math.round(n * (0.02 + rng.next() * 0.03)));
}

/** Queue a message: capture credits, then simulate queued, sending, sent, delivered. */
export function sendMessage(input: {
  churchId: string;
  body: string;
  audience: ResolvedAudience;
  segments: number;
  sentBy: string;
}): SendResult {
  const db = currentDb();
  if (!useDemoStore.getState().online) return { ok: false, error: "You're offline. Messages need a connection to send." };
  if (!input.body.trim()) return { ok: false, error: "Write a message first." };
  const n = input.audience.recipients.length;
  if (n === 0) return { ok: false, error: "This audience has no one who can receive SMS." };
  const credits = n * input.segments;
  const balance = walletBalance(db, input.churchId);
  if (credits > balance) return { ok: false, error: `Not enough credits: this needs ${credits.toLocaleString("en-US")} and the wallet has ${balance.toLocaleString("en-US")}.` };
  const now = new Date().toISOString();
  const message: Message = {
    id: randomUuid(),
    church_id: input.churchId,
    body: input.body.trim(),
    audience_label: input.audience.label,
    recipient_count: n,
    excluded_opt_out: input.audience.optedOut,
    segments: input.segments,
    credits,
    delivered: 0,
    failed: 0,
    status: "queued",
    sent_by: input.sentBy,
    created_at: now,
  };
  addRow("messages", message);
  addRow("sms_wallet", { id: randomUuid(), church_id: input.churchId, kind: "capture", credits: -credits, note: `Message to ${input.audience.label}`, created_at: now });
  advance(message.id);
  return { ok: true, message };
}

function finalize(m: Message) {
  const failed = failuresFor(m.id, m.recipient_count);
  patchRow("messages", m.id, { status: "delivered", delivered: m.recipient_count - failed, failed });
  if (failed) {
    addRow("sms_wallet", {
      id: randomUuid(),
      church_id: m.church_id,
      kind: "release",
      credits: failed * m.segments,
      note: `Released: ${failed} undelivered to ${m.audience_label}`,
      created_at: new Date().toISOString(),
    });
  }
}

function advance(id: string) {
  setTimeout(() => {
    patchRow("messages", id, { status: "sending" });
    setTimeout(() => {
      patchRow("messages", id, { status: "sent" });
      setTimeout(() => {
        const m = currentDb().messages.find((x) => x.id === id);
        if (m && m.status !== "delivered") finalize(m);
      }, STEP_MS);
    }, STEP_MS);
  }, STEP_MS / 2);
}

/** Messages left mid-flight by a page reload finish immediately. */
export function settleMessages(churchId: string) {
  const db = currentDb();
  const cutoff = Date.now() - 4 * STEP_MS;
  for (const m of db.messages) {
    if (m.church_id === churchId && m.status !== "delivered" && new Date(m.created_at).getTime() < cutoff) finalize(m);
  }
}

/** Retry the undelivered recipients of a message. Most go through on retry. */
export function retryFailed(m: Message): SendResult {
  const db = currentDb();
  if (!m.failed) return { ok: false, error: "Nothing to retry." };
  if (!useDemoStore.getState().online) return { ok: false, error: "You're offline. Retry once you're back online." };
  const credits = m.failed * m.segments;
  if (credits > walletBalance(db, m.church_id)) return { ok: false, error: "Not enough credits to retry." };
  const stillFailing = m.failed > 2 ? 1 : 0;
  const now = new Date().toISOString();
  addRow("sms_wallet", { id: randomUuid(), church_id: m.church_id, kind: "capture", credits: -credits, note: `Retry to ${m.audience_label}`, created_at: now });
  if (stillFailing) {
    addRow("sms_wallet", { id: randomUuid(), church_id: m.church_id, kind: "release", credits: stillFailing * m.segments, note: `Released: ${stillFailing} still undelivered`, created_at: now });
  }
  patchRow("messages", m.id, { delivered: m.recipient_count - stillFailing, failed: stillFailing });
  return { ok: true, message: { ...m, delivered: m.recipient_count - stillFailing, failed: stillFailing } };
}
