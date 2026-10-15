"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, HeartHandshake, Plus, UserCheck } from "lucide-react";
import {
  addProspect,
  addProspectNote,
  assigneeOptions,
  assignProspect,
  convertProspect,
  listDepartments,
  listProspects,
  memberById,
  moveProspect,
  prospectNotes,
  STAGE_LABEL,
  STAGES,
  useDb,
} from "@/data/repo";
import type { Prospect, ProspectStage } from "@/data/types";
import { canSeeContacts } from "@/lib/access";
import { dueLabel, fmtDate, toISODate } from "@/lib/dates";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { initials, plural } from "@/lib/cn";
import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal, Sheet } from "@/components/ui/Dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Chips, Tabs } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";
import { useGuideMark } from "@/components/shell/hooks";

const SOURCES = ["First-time guest", "Crusade contact", "Invited by a member", "Street evangelism", "Youth outreach", "Radio programme"];

function DueBadge({ p, now }: { p: Prospect; now: Date }) {
  if (p.stage === "converted" || !p.next_follow_up_on) return null;
  const d = dueLabel(p.next_follow_up_on, now);
  return <Badge tone={d.tone === "overdue" ? "inactive" : d.tone === "today" ? "new" : "neutral"}>{d.label}</Badge>;
}

export function SoulWinningScreen() {
  const db = useDb();
  const { church, role, can } = useChurch();
  const [view, setView] = useState<"board" | "list">("board");
  const [stage, setStage] = useState<ProspectStage | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  if (!can("soul_winning")) {
    return <NoAccess body={`${ROLES[role].label}: ${ROLES[role].limits}`} primary={{ href: churchHref(church.slug, ""), label: "Back to dashboard" }} />;
  }
  const prospects = listProspects(db, church.id);
  const weekAhead = toISODate(new Date(db.now.getTime() + 7 * 86_400_000));
  const due = prospects.filter((p) => p.stage !== "converted" && p.next_follow_up_on && p.next_follow_up_on <= weekAhead).length;
  const open = prospects.find((p) => p.id === openId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {plural(prospects.filter((p) => p.stage !== "converted").length, "prospect")} in progress · {plural(due, "follow-up")} due this week
          </p>
          <h1 className="mt-1 text-3xl font-extrabold">Soul-winning</h1>
        </div>
        <Button onClick={() => setAdding(true)} icon={<Plus className="size-4" aria-hidden />}>
          Add prospect
        </Button>
      </div>
      <Tabs
        label="View"
        value={view}
        onChange={setView}
        items={[
          { id: "board", label: "Pipeline" },
          { id: "list", label: "List" },
        ]}
        className="self-start"
      />

      {view === "board" ? (
        <>
          {/* Board on tablets and up; phones get the stage chips list */}
          <div className="hidden gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-[repeat(5,minmax(12.5rem,1fr))]">
            {STAGES.map((s) => {
              const items = prospects.filter((p) => p.stage === s.id);
              return (
                <section key={s.id} aria-labelledby={`col-${s.id}`} className="flex min-w-0 flex-col rounded-2xl bg-navy-50 p-2">
                  <h2 id={`col-${s.id}`} className="flex items-center justify-between px-2 py-2 text-sm font-bold">
                    {s.label}
                    <span className="tabular rounded-full bg-white px-2 text-xs text-muted">{items.length}</span>
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {items.map((p) => (
                      <li key={p.id}>
                        <ProspectCard p={p} onOpen={() => setOpenId(p.id)} />
                      </li>
                    ))}
                    {items.length === 0 && <li className="px-2 py-4 text-center text-xs text-muted">No one at this stage</li>}
                  </ul>
                </section>
              );
            })}
          </div>
          <div className="md:hidden">
            <StageList prospects={prospects} stage={stage} setStage={setStage} onOpen={setOpenId} />
          </div>
        </>
      ) : (
        <StageList prospects={prospects} stage={stage} setStage={setStage} onOpen={setOpenId} />
      )}

      {open && <ProspectSheet p={open} onClose={() => setOpenId(null)} />}
      {adding && <AddProspect onClose={() => setAdding(false)} onAdded={(id) => setOpenId(id)} />}
    </div>
  );
}

function ProspectCard({ p, onOpen }: { p: Prospect; onOpen: () => void }) {
  const db = useDb();
  const member = memberById(db, p.converted_member_id);
  return (
    <button type="button" onClick={onOpen} className="flex w-full flex-col items-start gap-1.5 rounded-xl border border-line bg-white p-3 text-left shadow-card hover:border-navy-200">
      <span className="font-semibold text-navy">
        {p.first_name} {p.last_name}
      </span>
      <span className="text-xs text-muted">
        {p.source} · {p.assignee_name}
      </span>
      {member ? <span className="text-xs font-semibold text-teal-ink">Member since {fmtDate(member.joined_on, "d MMM")}</span> : <DueBadge p={p} now={db.now} />}
    </button>
  );
}

function StageList({
  prospects,
  stage,
  setStage,
  onOpen,
}: {
  prospects: Prospect[];
  stage: ProspectStage | "all";
  setStage: (s: ProspectStage | "all") => void;
  onOpen: (id: string) => void;
}) {
  const db = useDb();
  const shown = prospects.filter((p) => stage === "all" || p.stage === stage);
  return (
    <div className="flex flex-col gap-3">
      <Chips
        label="Stage"
        value={stage}
        onChange={setStage}
        items={[{ id: "all" as const, label: "All", count: prospects.length }, ...STAGES.map((s) => ({ id: s.id, label: s.label, count: prospects.filter((p) => p.stage === s.id).length }))]}
      />
      {shown.length === 0 ? (
        <EmptyState icon={<HeartHandshake className="size-5" />} title="No one at this stage" />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {shown.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onOpen(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cloud">
                <Avatar initials={initials(p.first_name, p.last_name)} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-navy">
                    {p.first_name} {p.last_name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {STAGE_LABEL[p.stage]} · {p.assignee_name}
                  </span>
                </span>
                <DueBadge p={p} now={db.now} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProspectSheet({ p, onClose }: { p: Prospect; onClose: () => void }) {
  const db = useDb();
  const { church, role, persona } = useChurch();
  const mark = useGuideMark();
  const [note, setNote] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const router = useRouter();
  const notes = prospectNotes(db, p.id);
  const member = memberById(db, p.converted_member_id);
  const idx = STAGES.findIndex((s) => s.id === p.stage);
  const nextStage = STAGES[idx + 1];
  const assignees = assigneeOptions(db, church.id);

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${p.first_name} ${p.last_name}`}
      description={`${p.source} · first contact ${fmtDate(p.first_contact_on)}`}
      footer={
        member ? (
          <ButtonLink href={`${churchHref(church.slug, "members")}?id=${member.id}`} icon={<UserCheck className="size-4" aria-hidden />}>
            Open member profile
          </ButtonLink>
        ) : (
          <>
            {nextStage && nextStage.id !== "converted" && (
              <Button variant="secondary" onClick={() => moveProspect(p, nextStage.id, persona.display)} icon={<ArrowRight className="size-4" aria-hidden />} className="flex-row-reverse">
                Move to {nextStage.label}
              </Button>
            )}
            <Button variant="teal" onClick={() => setConverting(true)} icon={<CheckCircle2 className="size-4" aria-hidden />}>
              Convert to member
            </Button>
          </>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-muted">Stage</dt>
          <dd className="mt-1">
            {member ? (
              <Badge tone="active">Converted · member since {fmtDate(member.joined_on, "d MMM")}</Badge>
            ) : (
              <>
                <label htmlFor="stage" className="sr-only">
                  Stage
                </label>
                <Select id="stage" value={p.stage} onChange={(e) => moveProspect(p, e.target.value as ProspectStage, persona.display)}>
                  {STAGES.filter((s) => s.id !== "converted").map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </>
            )}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-muted">Assigned to</dt>
          <dd className="mt-1">
            <label htmlFor="assignee" className="sr-only">
              Assigned to
            </label>
            <Select id="assignee" value={p.assignee_name} disabled={!!member} onChange={(e) => assignProspect(p, e.target.value)}>
              {assignees.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Phone</dt>
          <dd className="mt-0.5 text-ink">{canSeeContacts(role) ? (p.phone ? formatPhone(p.phone) : "Not recorded") : "Hidden for your role"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Next follow-up</dt>
          <dd className="mt-0.5 text-ink">{p.next_follow_up_on ? fmtDate(p.next_follow_up_on, "EEE d MMM") : "None scheduled"}</dd>
        </div>
      </dl>

      <section className="mt-6">
        <h3 className="text-sm font-bold text-navy">Follow-up notes</h3>
        <form
          className="mt-3 flex flex-col gap-3 rounded-xl bg-cloud p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim().length < 3) return setError("Write a short note about the conversation or visit.");
            addProspectNote(p, note.trim(), persona.display, next || null);
            toast("Note saved", { body: next ? `Next follow-up on ${fmtDate(next, "EEE d MMM")}.` : "Saved with today's date." });
            setNote("");
            setNext("");
            setError(null);
          }}
        >
          <Field label="New note" error={error}>
            {(fp) => <Textarea {...fp} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Visited at home; she will come on Sunday with her sister." />}
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Next follow-up (optional)" className="min-w-44 flex-1">
              {(fp) => <Input {...fp} type="date" value={next} min={toISODate(new Date())} onChange={(e) => setNext(e.target.value)} />}
            </Field>
            <Button type="submit" variant="secondary">
              Save note
            </Button>
          </div>
        </form>
        <ol className="mt-4 flex flex-col gap-3 border-l-2 border-line pl-4">
          {notes.map((n) => (
            <li key={n.id}>
              <p className="text-xs text-muted">
                {fmtDate(n.created_at, "d MMM yyyy")} · {n.author_name}
              </p>
              <p className="text-sm text-ink">{n.note}</p>
            </li>
          ))}
        </ol>
      </section>

      {converting && (
        <ConvertDialog
          p={p}
          onClose={() => setConverting(false)}
          onDone={(memberId) => {
            mark("convert_prospect");
            setConverting(false);
            toast(`${p.first_name} ${p.last_name} is now a member`, {
              body: "Their follow-up history stays on the member profile.",
              action: { label: "Open", onClick: () => router.push(`${churchHref(church.slug, "members")}?id=${memberId}`) },
            });
          }}
        />
      )}
    </Sheet>
  );
}

function ConvertDialog({ p, onClose, onDone }: { p: Prospect; onClose: () => void; onDone: (memberId: string) => void }) {
  const db = useDb();
  const { church, persona } = useChurch();
  const [depts, setDepts] = useState<string[]>([]);
  const departments = listDepartments(db, church.id);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Welcome ${p.first_name} as a member?`}
      description="Creates their member record today. The soul-winning history moves with them."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="teal" onClick={() => onDone(convertProspect(p, persona.display, depts).id)}>
            Convert to member
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="text-sm font-semibold text-navy">Departments (optional)</legend>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2">
          {departments.map((d) => (
            <Checkbox key={d.id} label={d.name} checked={depts.includes(d.id)} onChange={(e) => setDepts(e.target.checked ? [...depts, d.id] : depts.filter((x) => x !== d.id))} />
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-xs text-muted">They&apos;ll show as New for 28 days. {p.assignee_name}&apos;s follow-up notes stay on their profile.</p>
    </Modal>
  );
}

function AddProspect({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const db = useDb();
  const { church, persona } = useChurch();
  const assignees = useMemo(() => assigneeOptions(db, church.id), [db, church.id]);
  const [f, setF] = useState({ first: "", last: "", phone: "", source: SOURCES[0], assignee: assignees[0] ?? persona.display, next: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const phone = f.phone.trim() ? normalizePhone(f.phone) : null;
  const save = () => {
    const e: Record<string, string> = {};
    if (!f.first.trim()) e.first = "Enter a first name.";
    if (!f.last.trim()) e.last = "Enter a last name.";
    if (phone && !phone.ok) e.phone = phone.error ?? "Check the number.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const p = addProspect(
      church.id,
      { first_name: f.first.trim(), last_name: f.last.trim(), phone: phone?.e164 ?? null, source: f.source, assignee_name: f.assignee, next_follow_up_on: f.next || null },
      persona.display,
    );
    toast("Prospect added", { body: `${p.first_name} ${p.last_name} is in New contact, assigned to ${p.assignee_name}.` });
    onClose();
    onAdded(p.id);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Add prospect"
      description="Someone the church is reaching out to."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Add prospect</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.first}>{(p) => <Input {...p} value={f.first} onChange={set("first")} />}</Field>
          <Field label="Last name" error={errors.last}>{(p) => <Input {...p} value={f.last} onChange={set("last")} />}</Field>
        </div>
        <Field label="Phone (optional)" error={errors.phone} hint={phone?.ok ? <span className="font-semibold text-teal-ink">Saved as {formatPhone(phone.e164)}</span> : undefined}>
          {(p) => <Input {...p} inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="0886 123 456" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How we met">
            {(p) => (
              <Select {...p} value={f.source} onChange={set("source")}>
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Assign to">
            {(p) => (
              <Select {...p} value={f.assignee} onChange={set("assignee")}>
                {assignees.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="First follow-up (optional)" hint="Appears on the dashboard's follow-up tasks.">
          {(p) => <Input {...p} type="date" value={f.next} min={toISODate(new Date())} onChange={set("next")} />}
        </Field>
      </div>
    </Modal>
  );
}
