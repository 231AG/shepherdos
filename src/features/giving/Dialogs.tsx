"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { closeDay, discardDraft, memberById, memberName, postDraft, reverseGiving, useDb, type LedgerRow, type ServiceGivingTotals } from "@/data/repo";
import { GIVING_TYPE_SINGULAR, REVERSAL_REASONS } from "@/lib/giving";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtTime } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { useGuideMark } from "@/components/shell/hooks";

function Summary({ row }: { row: LedgerRow }) {
  const db = useDb();
  const who = row.member_id ? memberName(memberById(db, row.member_id)) : row.giver_label;
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-cloud p-4 text-sm">
      <div>
        <dt className="text-xs text-muted">Ref</dt>
        <dd className="font-semibold text-navy">{row.ref}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Amount</dt>
        <dd className="tabular font-semibold text-navy">{formatMoney(row.amount_minor, row.currency)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Giver</dt>
        <dd className="text-ink">{who}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Type · time</dt>
        <dd className="text-ink">
          {GIVING_TYPE_SINGULAR[row.type]} · {fmtTime(row.created_at)}
        </dd>
      </div>
    </dl>
  );
}

export function ReverseDialog({ row, onClose }: { row: LedgerRow; onClose: () => void }) {
  const { persona } = useChurch();
  const mark = useGuideMark();
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (!reason) return setError("Choose a reason. Every reversal needs one.");
    if (reason === "Other" && details.trim().length < 3) return setError("Describe the reason.");
    const text = reason === "Other" ? details.trim() : details.trim() ? `${reason}: ${details.trim()}` : reason;
    const r = reverseGiving(row.entry!, text, persona.display);
    if (!r.ok) return setError(r.error);
    mark("reverse_entry");
    toast(`${r.value.ref} posted`, { body: `${row.ref} is marked reversed. Post a new entry if the gift should be recorded differently.` });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Reverse ${row.ref}`}
      description="Posts a compensating entry. The original stays in the ledger, marked as reversed."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit}>
            Post reversal
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Summary row={row} />
        <Field label="Reason" error={error && !reason ? error : null}>
          {(p) => (
            <Select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose a reason</option>
              {REVERSAL_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
              <option>Other</option>
            </Select>
          )}
        </Field>
        <Field label={reason === "Other" ? "Describe the reason" : "Details (optional)"} hint="Saved with the reversal and your name." error={error && reason ? error : null}>
          {(p) => <Textarea {...p} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. Counted twice; re-entered as the correct amount" />}
        </Field>
      </div>
    </Modal>
  );
}

export function DraftDialog({ row, onClose }: { row: LedgerRow; onClose: () => void }) {
  const { persona } = useChurch();
  const mark = useGuideMark();
  const [error, setError] = useState<string | null>(null);
  const draft = row.draft!;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Review draft ${row.ref}`}
      description={`Captured on ${draft.device} at ${fmtTime(draft.created_at)}. Drafts don't count until posted.`}
      footer={
        <>
          <Button
            variant="secondary"
            className="text-danger-ink"
            onClick={() => {
              discardDraft(draft);
              mark("review_drafts");
              toast("Draft discarded", { body: `${row.ref} won't be posted.` });
              onClose();
            }}
          >
            Discard draft
          </Button>
          <Button
            onClick={() => {
              const r = postDraft(draft, persona.display);
              if (!r.ok) return setError(r.error);
              mark("review_drafts");
              toast(`${r.value.ref} posted`, { body: `Draft ${row.ref} is now in the ledger and in the totals.` });
              onClose();
            }}
          >
            Post to ledger
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Summary row={row} />
        {row.possibleDuplicateOf && (
          <p className="flex items-start gap-2 rounded-xl bg-gold-soft px-3 py-2.5 text-sm text-gold-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Possible duplicate of {row.possibleDuplicateOf}: same giver, amount and currency within 10 minutes. Offline duplicates are never merged automatically.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-danger-ink">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function CloseDayDialog({ day, totals, reversals, onClose }: { day: string; totals: ServiceGivingTotals; reversals: number; onClose: () => void }) {
  const { church, persona } = useChurch();
  const mark = useGuideMark();
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Close ${fmtDate(day, "EEEE d MMMM")}?`}
      description="After closing, nothing more can be posted or reversed for this day."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const r = closeDay(church.id, day, persona.display);
              if (!r.ok) return setError(r.error);
              mark("close_day");
              toast("Day closed", { body: `${fmtDate(day, "d MMM")} is locked. Totals are final.` });
              onClose();
            }}
          >
            Close day
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-navy p-3 text-white">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-gold">Posted · LRD</dt>
          <dd className="tabular mt-1 font-heading text-lg font-bold">{formatMoney(totals.posted.LRD, "LRD")}</dd>
        </div>
        <div className="rounded-xl bg-navy-50 p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Posted · USD</dt>
          <dd className="tabular mt-1 font-heading text-lg font-bold text-navy">{formatMoney(totals.posted.USD, "USD")}</dd>
        </div>
        <div className="col-span-2 text-muted">
          {totals.entryCount} posted entries{reversals ? `, ${reversals} reversal${reversals === 1 ? "" : "s"}` : ""}. The two currencies stay separate.
        </div>
      </dl>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger-ink">
          {error}
        </p>
      )}
    </Modal>
  );
}
