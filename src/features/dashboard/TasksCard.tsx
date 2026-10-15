"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { listOpenTasks, logFollowUpNote, useDb, type TaskView } from "@/data/repo";
import { canAccess } from "@/lib/access";
import { dueLabel } from "@/lib/dates";
import { initials } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Field";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { churchHref } from "@/components/shell/nav";
import { useGuideMark } from "@/components/shell/hooks";

export function TasksCard({ limit = 4 }: { limit?: number }) {
  const db = useDb();
  const { church, role, scope, persona } = useChurch();
  const mark = useGuideMark();
  const tasks = listOpenTasks(db, church.id, scope);
  const [open, setOpen] = useState<TaskView | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!open) return;
    if (note.trim().length < 3) {
      setError("Write a short note about what happened.");
      return;
    }
    logFollowUpNote(open.task, note.trim(), persona.display);
    mark("log_note");
    toast("Follow-up logged", { body: `${open.name} is marked as followed up.` });
    setOpen(null);
    setNote("");
    setError(null);
  };

  return (
    <Card>
      <CardHeader
        title="Follow-up tasks"
        subtitle={scope.kind === "department" ? `${scope.department.name} members only` : undefined}
        action={
          canAccess(role, "soul_winning") ? (
            <Link href={churchHref(church.slug, "soul-winning")} className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-ink underline underline-offset-4 md:min-h-0">
              View pipeline
            </Link>
          ) : undefined
        }
      />
      {tasks.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="size-5" />} title="No follow-ups due" body="Everyone on your list has been contacted. New guests and inactive members appear here." />
      ) : (
        <ul className="px-5 pb-3 pt-2">
          {tasks.slice(0, limit).map((t) => {
            const due = dueLabel(t.task.due_on, db.now);
            return (
              <li key={t.task.id} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
                <Avatar initials={initials(t.name)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{t.name}</p>
                  <p className="truncate text-xs text-muted">
                    <span className={`font-semibold sm:hidden ${due.tone === "overdue" ? "text-danger-ink" : due.tone === "today" ? "text-gold-ink" : "text-navy-700"}`}>
                      {due.label} ·{" "}
                    </span>
                    {t.task.context} · {t.task.assignee_name}
                  </p>
                </div>
                <span className="hidden sm:block">
                  <Badge tone={due.tone === "overdue" ? "inactive" : due.tone === "today" ? "new" : "neutral"}>{due.label}</Badge>
                </span>
                <Button variant="secondary" size="sm" onClick={() => setOpen(t)} aria-label={`Log note for ${t.name}`}>
                  Log note
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {tasks.length > limit && <p className="px-5 pb-4 text-xs text-muted">{tasks.length - limit} more on the list</p>}

      <Modal
        open={!!open}
        onClose={() => {
          setOpen(null);
          setError(null);
        }}
        title={open ? `Follow-up: ${open.name}` : ""}
        description={open ? `${open.task.context} · assigned to ${open.task.assignee_name}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save note</Button>
          </>
        }
      >
        <Field label="What happened?" hint="Saved with today's date and your name. The task is then marked done." error={error}>
          {(p) => (
            <Textarea
              {...p}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Called her. She is travelling and will be back on Sunday."
            />
          )}
        </Field>
      </Modal>
    </Card>
  );
}
