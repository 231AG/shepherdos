"use client";

/** Soul-winning pipeline: prospects, follow-up notes and conversion. Re-exported by repo.ts. */
import { randomUuid } from "@/mock/prng";
import { toISODate } from "@/lib/dates";
import { addRow, addRows, currentDb, patchRow, patchRows, type Db } from "./core";
import type { FollowUpEvent, Member, Prospect, ProspectStage } from "./types";

export const STAGES: { id: ProspectStage; label: string }[] = [
  { id: "new_contact", label: "New contact" },
  { id: "contacted", label: "Contacted" },
  { id: "visiting", label: "Visiting" },
  { id: "ready_to_join", label: "Ready to join" },
  { id: "converted", label: "Converted" },
];

export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label])) as Record<ProspectStage, string>;

export function listProspects(db: Db, churchId: string): Prospect[] {
  return db.prospects.filter((p) => p.church_id === churchId).sort((a, b) => (a.next_follow_up_on ?? "9999").localeCompare(b.next_follow_up_on ?? "9999"));
}

export function prospectNotes(db: Db, prospectId: string): FollowUpEvent[] {
  return db.follow_up_events.filter((e) => e.prospect_id === prospectId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Assignees: church staff plus the names already used on prospects. */
export function assigneeOptions(db: Db, churchId: string): string[] {
  const names = new Set(db.prospects.filter((p) => p.church_id === churchId).map((p) => p.assignee_name));
  for (const s of db.staff) if (s.church_id === churchId) names.add(s.display_name);
  return [...names].sort();
}

export interface ProspectInput {
  first_name: string;
  last_name: string;
  phone: string | null;
  source: string;
  assignee_name: string;
  next_follow_up_on: string | null;
}

export function addProspect(churchId: string, input: ProspectInput, author: string): Prospect {
  const now = new Date();
  const prospect: Prospect = {
    id: randomUuid(),
    church_id: churchId,
    ...input,
    stage: "new_contact",
    first_contact_on: toISODate(now),
    converted_member_id: null,
    created_at: now.toISOString(),
  };
  addRow("prospects", prospect);
  addRow("follow_up_events", {
    id: randomUuid(),
    church_id: churchId,
    prospect_id: prospect.id,
    member_id: null,
    note: `${input.source}. Contact details taken.`,
    author_name: author,
    created_at: now.toISOString(),
  });
  if (input.next_follow_up_on) addFollowUpTask(prospect, input.next_follow_up_on);
  return prospect;
}

function addFollowUpTask(p: Prospect, due: string) {
  addRow("tasks", {
    id: randomUuid(),
    church_id: p.church_id,
    subject: "prospect",
    prospect_id: p.id,
    member_id: null,
    context: `${p.source}, ${new Date(p.first_contact_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    assignee_name: p.assignee_name,
    due_on: due,
    done_at: null,
    created_at: new Date().toISOString(),
  });
}

/** Close any open dashboard task for this prospect. */
function closeTasks(prospectId: string) {
  const db = currentDb();
  const now = new Date().toISOString();
  patchRows("tasks", Object.fromEntries(db.tasks.filter((t) => t.prospect_id === prospectId && !t.done_at).map((t) => [t.id, { done_at: now }])));
}

export function moveProspect(p: Prospect, stage: ProspectStage, author: string) {
  if (stage === p.stage || stage === "converted") return;
  patchRow("prospects", p.id, { stage });
  addRow("follow_up_events", {
    id: randomUuid(),
    church_id: p.church_id,
    prospect_id: p.id,
    member_id: null,
    note: `Moved from ${STAGE_LABEL[p.stage]} to ${STAGE_LABEL[stage]}.`,
    author_name: author,
    created_at: new Date().toISOString(),
  });
}

export function assignProspect(p: Prospect, assignee: string) {
  patchRow("prospects", p.id, { assignee_name: assignee });
}

/** Dated follow-up note. Optionally schedules the next follow-up (and its dashboard task). */
export function addProspectNote(p: Prospect, note: string, author: string, nextFollowUp: string | null) {
  addRow("follow_up_events", {
    id: randomUuid(),
    church_id: p.church_id,
    prospect_id: p.id,
    member_id: p.converted_member_id,
    note,
    author_name: author,
    created_at: new Date().toISOString(),
  });
  closeTasks(p.id);
  patchRow("prospects", p.id, { next_follow_up_on: nextFollowUp });
  if (nextFollowUp && p.stage !== "converted") addFollowUpTask(p, nextFollowUp);
}

/**
 * Convert a prospect into a member in one step: the member is created, the
 * prospect is marked converted and linked, and the whole follow-up history
 * stays attached (the member profile shows it).
 */
export function convertProspect(p: Prospect, author: string, departmentIds: string[]): Member {
  const db = currentDb();
  if (p.converted_member_id) return db.members.find((m) => m.id === p.converted_member_id)!;
  const now = new Date();
  const member: Member = {
    id: randomUuid(),
    church_id: p.church_id,
    first_name: p.first_name,
    last_name: p.last_name,
    phone: p.phone,
    gender: null,
    joined_on: toISODate(now),
    exception: null,
    sms_opt_out: false,
    household: null,
    converted_from_prospect_id: p.id,
    imported_at: null,
    created_at: now.toISOString(),
  };
  addRow("members", member);
  addRows(
    "member_departments",
    departmentIds.map((department_id) => ({ id: randomUuid(), church_id: p.church_id, member_id: member.id, department_id, created_at: now.toISOString() })),
  );
  patchRow("prospects", p.id, { stage: "converted", converted_member_id: member.id, next_follow_up_on: null });
  addRow("follow_up_events", {
    id: randomUuid(),
    church_id: p.church_id,
    prospect_id: p.id,
    member_id: member.id,
    note: "Converted to member. Welcome to the church family.",
    author_name: author,
    created_at: now.toISOString(),
  });
  closeTasks(p.id);
  return member;
}
