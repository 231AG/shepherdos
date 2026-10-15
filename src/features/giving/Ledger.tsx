"use client";

import { Download, FileClock, Undo2 } from "lucide-react";
import { memberById, memberName, useDb, type LedgerRow } from "@/data/repo";
import { GIVING_TYPE_SINGULAR } from "@/lib/giving";
import { formatMoney } from "@/lib/money";
import { fmtTime } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";

function shortName(full: string) {
  const parts = full.replace(/^(Rev\.|Sis\.|Bro\.|Deacon)\s+/, "").split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : full;
}

export function StatusCell({ row }: { row: LedgerRow }) {
  switch (row.status) {
    case "posted":
      return <Badge tone="active">Posted</Badge>;
    case "reversed":
      return (
        <div className="flex flex-col items-start gap-0.5">
          <Badge tone="outline">Posted · reversed</Badge>
          <span className="text-[11px] text-muted">Corrected by {row.linkedRef}</span>
        </div>
      );
    case "reversal":
      return (
        <div className="flex max-w-56 flex-col items-start gap-0.5">
          <Badge tone="inactive">Reversal</Badge>
          <span className="text-[11px] leading-snug text-danger-ink">
            Reverses {row.linkedRef}. {row.reason} · by {shortName(row.actor)}
          </span>
        </div>
      );
    default:
      return (
        <div className="flex max-w-56 flex-col items-start gap-0.5">
          <Badge tone="new">{row.status === "draft" ? "Draft · on device" : "Draft · offline"}</Badge>
          <span className="text-[11px] leading-snug text-gold-ink">
            {row.status === "draft" ? "Waiting to sync from this device." : `Captured on ${row.draft?.device}. Not in totals.`}
            {row.possibleDuplicateOf && ` Possible duplicate of ${row.possibleDuplicateOf}.`}
          </span>
        </div>
      );
  }
}

function ActionButton({ kind, refLabel, onClick, compact }: { kind: "reverse" | "review"; refLabel: string; onClick: () => void; compact: boolean }) {
  const label = kind === "reverse" ? "Reverse" : "Review";
  const Icon = kind === "reverse" ? Undo2 : FileClock;
  if (compact)
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${label} ${refLabel}`}
        title={`${label} ${refLabel}`}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg border",
          kind === "review" ? "border-navy bg-navy text-white hover:bg-navy-700" : "border-line-strong bg-white text-navy hover:bg-navy-50",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </button>
    );
  return (
    <Button variant={kind === "review" ? "primary" : "secondary"} size="sm" onClick={onClick} icon={<Icon className="size-3.5" aria-hidden />} aria-label={`${label} ${refLabel}`}>
      {label}
    </Button>
  );
}

export function Ledger({
  rows,
  title,
  canAct,
  dayClosed,
  onReverse,
  onReview,
  onExport,
}: {
  rows: LedgerRow[];
  title: string;
  canAct: boolean;
  dayClosed: boolean;
  onReverse: (row: LedgerRow) => void;
  onReview: (row: LedgerRow) => void;
  onExport: () => void;
}) {
  const db = useDb();
  const giver = (r: LedgerRow) => (r.member_id ? memberName(memberById(db, r.member_id)) : r.giver_label ?? "Unknown");
  const amount = (r: LedgerRow) => formatMoney(r.status === "reversal" ? -r.amount_minor : r.amount_minor, r.currency);
  const action = (r: LedgerRow, compact: boolean) => {
    if (!canAct) return null;
    if (r.status === "posted" && !dayClosed) return <ActionButton kind="reverse" refLabel={r.ref} onClick={() => onReverse(r)} compact={compact} />;
    if (r.status === "draft_synced") return <ActionButton kind="review" refLabel={`draft ${r.ref}`} onClick={() => onReview(r)} compact={compact} />;
    return null;
  };
  const rowTone = (r: LedgerRow) => (r.status === "reversal" ? "bg-danger-soft/50" : r.kind === "draft" ? "bg-gold-soft/50" : "");

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={`${rows.length} rows · newest first`}
        action={
          <Button variant="secondary" size="sm" onClick={onExport} icon={<Download className="size-4" aria-hidden />}>
            Export CSV
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No giving recorded for this service yet" body={canAct ? "Use Record giving to add the first entry." : undefined} />
      ) : (
        <>
          <div className="mt-4 hidden md:block">
            <Table>
              <caption className="sr-only">{title}</caption>
              <THead>
                <tr>
                  <TH scope="col">Ref</TH>
                  <TH scope="col">Time</TH>
                  <TH scope="col">Giver</TH>
                  <TH scope="col" className="hidden 2xl:table-cell">
                    Type
                  </TH>
                  <TH scope="col" className="text-right">
                    Amount
                  </TH>
                  <TH scope="col">Status</TH>
                  {canAct && (
                    <TH scope="col">
                      <span className="sr-only">Actions</span>
                    </TH>
                  )}
                </tr>
              </THead>
              <tbody>
                {rows.map((r) => (
                  <TR key={r.id} className={rowTone(r)}>
                    <TD className="whitespace-nowrap font-semibold text-navy">{r.ref}</TD>
                    <TD className="tabular whitespace-nowrap text-muted">{fmtTime(r.created_at)}</TD>
                    <TD className="text-ink">
                      {giver(r)}
                      <span className="block text-xs text-muted 2xl:hidden">{GIVING_TYPE_SINGULAR[r.type]}</span>
                    </TD>
                    <TD className="hidden whitespace-nowrap text-ink 2xl:table-cell">{GIVING_TYPE_SINGULAR[r.type]}</TD>
                    <TD
                      className={cn(
                        "tabular whitespace-nowrap text-right font-semibold",
                        r.status === "reversal" ? "text-danger-ink" : r.kind === "draft" ? "text-gold-ink" : "text-navy",
                      )}
                    >
                      {amount(r)}
                    </TD>
                    <TD>
                      <StatusCell row={r} />
                    </TD>
                    {canAct && <TD className="w-12 py-2 text-right">{action(r, true)}</TD>}
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
          <ul className="mt-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className={cn("border-t border-line px-4 py-3", rowTone(r))}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-navy">
                      {r.ref} · <span className="font-normal text-muted">{fmtTime(r.created_at)}</span>
                    </p>
                    <p className="truncate font-semibold text-ink">{giver(r)}</p>
                    <p className="text-xs text-muted">{GIVING_TYPE_SINGULAR[r.type]}</p>
                  </div>
                  <p className={cn("tabular whitespace-nowrap font-semibold", r.status === "reversal" ? "text-danger-ink" : r.kind === "draft" ? "text-gold-ink" : "text-navy")}>
                    {amount(r)}
                  </p>
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <StatusCell row={r} />
                  {action(r, false)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
