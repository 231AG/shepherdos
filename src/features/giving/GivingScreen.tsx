"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EyeOff, Lock } from "lucide-react";
import {
  dayClose,
  defaultGivingService,
  givingServices,
  givingSummary,
  lastServicesTotals,
  ledgerForService,
  memberById,
  memberName,
  monthRange,
  pendingDraftsForDay,
  serviceDay,
  serviceGivingTotals,
  useDb,
  type LedgerRow,
} from "@/data/repo";
import { GIVING_TYPES } from "@/data/types";
import { canSeeLedger } from "@/lib/access";
import { downloadCsv } from "@/lib/csv";
import { fmtDate, fmtTime } from "@/lib/dates";
import { GIVING_TYPE_LABEL, GIVING_TYPE_SINGULAR } from "@/lib/giving";
import { formatAmount, formatMoney } from "@/lib/money";
import { ROLES } from "@/lib/roles";
import { cn, plural } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";
import { useGuideMark } from "@/components/shell/hooks";
import { CaptureForm } from "./CaptureForm";
import { CloseDayDialog, DraftDialog, ReverseDialog } from "./Dialogs";
import { Ledger } from "./Ledger";

export function GivingScreen() {
  const db = useDb();
  const { church, role, can } = useChurch();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mark = useGuideMark();
  const [reverse, setReverse] = useState<LedgerRow | null>(null);
  const [review, setReview] = useState<LedgerRow | null>(null);
  const [closing, setClosing] = useState(false);
  // Remember the service first shown, so closing its day doesn't jump elsewhere.
  const [pinnedId] = useState(() => defaultGivingService(db, church.id)?.id ?? null);

  useEffect(() => {
    if (role === "pastor") mark("view_giving");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (!can("giving")) {
    return (
      <NoAccess
        body={
          role === "pastor"
            ? "This church has turned off giving for pastors. Change it in Settings, under Giving visibility."
            : `${ROLES[role].label}: ${ROLES[role].limits}`
        }
        primary={
          role === "pastor"
            ? { href: `${churchHref(church.slug, "settings")}?tab=giving`, label: "Open Settings" }
            : { href: churchHref(church.slug, ""), label: "Back to dashboard" }
        }
      />
    );
  }

  const ledgerVisible = canSeeLedger(role, church.settings);
  const isTreasurer = role === "treasurer";
  const services = givingServices(db, church.id);
  const requested = services.find((s) => s.id === params.get("service"));
  const service = requested ?? services.find((s) => s.id === pinnedId) ?? defaultGivingService(db, church.id);

  const pickService = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("service", id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  if (!service) return <p className="text-muted">No services yet.</p>;
  const day = serviceDay(service);
  const close = dayClose(db, church.id, day);
  const totals = serviceGivingTotals(db, church.id, service.id);
  const rows = ledgerForService(db, church.id, service.id);
  const pendingForDay = pendingDraftsForDay(db, church.id, day).length;
  const reversals = rows.filter((r) => r.status === "reversal").length;
  // A day can only be closed once its service has started.
  const closable = new Date(service.starts_at) <= new Date();

  const exportCsv = () => {
    const giver = (r: LedgerRow) => (r.member_id ? memberName(memberById(db, r.member_id)) : (r.giver_label ?? ""));
    const status: Record<LedgerRow["status"], string> = { posted: "Posted", reversed: "Posted (reversed)", reversal: "Reversal", draft: "Draft (on device)", draft_synced: "Draft (not in totals)" };
    downloadCsv(`giving_${church.slug}_${day}.csv`, [
      ["Ref", "Date", "Time", "Giver", "Type", "Currency", "Amount", "Status", "Linked ref", "Reason", "Recorded by"],
      ...rows.map((r) => [
        r.ref,
        fmtDate(r.created_at, "yyyy-MM-dd"),
        fmtTime(r.created_at),
        giver(r),
        GIVING_TYPE_SINGULAR[r.type],
        r.currency,
        ((r.status === "reversal" ? -r.amount_minor : r.amount_minor) / 100).toFixed(2),
        status[r.status],
        r.linkedRef ?? "",
        r.reason ?? "",
        r.actor,
      ]),
    ]);
    mark("export_csv");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted">
            {ledgerVisible ? `${service.name} · ${fmtDate(service.starts_at, "EEE d MMM yyyy")}` : "Totals per currency"}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold">Giving</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("w-full sm:w-72", !ledgerVisible && "hidden")}>
            <label htmlFor="giving-service" className="sr-only">
              Service
            </label>
            <Select id="giving-service" value={service.id} onChange={(e) => pickService(e.target.value)}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {fmtDate(s.starts_at, "EEE d MMM")} · {s.name}
                  {dayClose(db, church.id, serviceDay(s)) ? " (closed)" : !s.closed ? " (open)" : ""}
                </option>
              ))}
            </Select>
          </div>
          {isTreasurer &&
            closable &&
            (close ? (
              <Badge tone="excused" className="py-1.5">
                <Lock className="size-3.5" aria-hidden /> Closed by {close.closed_by} · {fmtDate(close.created_at, "d MMM, h:mm a")}
              </Badge>
            ) : (
              <div className="flex items-center gap-3">
                {pendingForDay > 0 && <span className="text-sm text-muted">{plural(pendingForDay, "draft")} must be reviewed before close</span>}
                <Button variant={pendingForDay ? "secondary" : "primary"} disabled={pendingForDay > 0} onClick={() => setClosing(true)}>
                  Close day
                </Button>
              </div>
            ))}
        </div>
      </div>

      {!ledgerVisible && <PastorTotals />}

      {ledgerVisible && (
        <div className={cn("grid gap-5 lg:gap-6", isTreasurer && "lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]")}>
          {isTreasurer && (
            <div>
              <CaptureForm service={service} dayClosed={!!close} />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-navy p-4 text-white shadow-card">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Posted · LRD</p>
                <p className="tabular mt-1 font-heading text-2xl font-extrabold">{formatAmount(totals.posted.LRD)}</p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Posted · USD</p>
                <p className="tabular mt-1 font-heading text-2xl font-extrabold text-navy">{formatAmount(totals.posted.USD)}</p>
              </div>
              <div className="col-span-2 rounded-2xl border-2 border-dashed border-gold bg-gold-soft p-4 sm:col-span-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-ink">Drafts · not in totals</p>
                {totals.draftCount ? (
                  <p className="tabular mt-1 text-sm font-bold text-gold-ink">
                    {formatMoney(totals.drafts.LRD, "LRD")}
                    <br />
                    {formatMoney(totals.drafts.USD, "USD")}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gold-ink">None waiting</p>
                )}
              </div>
            </div>
            <Ledger
              rows={rows}
              title="Ledger · this service"
              canAct={isTreasurer}
              dayClosed={!!close}
              onReverse={setReverse}
              onReview={setReview}
              onExport={exportCsv}
            />
            {role === "pastor" && (
              <p className="text-sm text-muted">
                You&apos;re seeing the full ledger because this church allows it. Only the treasurer records, reverses and closes.
              </p>
            )}
          </div>
        </div>
      )}

      {reverse && <ReverseDialog row={reverse} onClose={() => setReverse(null)} />}
      {review && <DraftDialog row={review} onClose={() => setReview(null)} />}
      {closing && <CloseDayDialog day={day} totals={totals} reversals={reversals} onClose={() => setClosing(false)} />}
    </div>
  );
}

/** Pastor with "totals only": per-currency totals, by type and per service. No ledger rows. */
function PastorTotals() {
  const db = useDb();
  const { church } = useChurch();
  const month = givingSummary(db, church.id, monthRange(db.now));
  const recent = lastServicesTotals(db, church.id, 8);
  return (
    <>
      <div className="flex items-start gap-3 rounded-2xl border border-navy-100 bg-navy-50 px-4 py-3 text-sm text-navy">
        <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="font-semibold">Totals only.</span> This church shows the Pastor giving totals, not individual entries. The setting is in{" "}
          <Link href={churchHref(church.slug, "settings")} className="font-semibold underline underline-offset-4">
            Settings
          </Link>
          .
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title={`This month · ${fmtDate(db.now, "MMMM")}`} />
          <div className="grid grid-cols-2 gap-3 px-5 pt-4">
            <div className="rounded-xl bg-navy p-3.5 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Posted · LRD</p>
              <p className="tabular mt-1 font-heading text-xl font-extrabold">{formatAmount(month.posted.LRD)}</p>
            </div>
            <div className="rounded-xl bg-navy-50 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Posted · USD</p>
              <p className="tabular mt-1 font-heading text-xl font-extrabold text-navy">{formatAmount(month.posted.USD)}</p>
            </div>
          </div>
          <table className="mx-5 mb-5 mt-3 w-[calc(100%-2.5rem)] text-sm">
            <caption className="sr-only">This month by type, per currency</caption>
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted">
                <th scope="col" className="py-2 text-left font-semibold">Type</th>
                <th scope="col" className="py-2 text-right font-semibold">LRD</th>
                <th scope="col" className="py-2 text-right font-semibold">USD</th>
              </tr>
            </thead>
            <tbody>
              {GIVING_TYPES.map((t) => (
                <tr key={t} className="border-t border-line">
                  <th scope="row" className="py-2.5 text-left font-medium text-ink">{GIVING_TYPE_LABEL[t]}</th>
                  <td className="tabular py-2.5 text-right">{formatAmount(month.byType[t].LRD)}</td>
                  <td className="tabular py-2.5 text-right">{formatAmount(month.byType[t].USD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader title="Recent services" subtitle="Posted totals per service, per currency" />
          <div className="mt-4">
            <Table>
              <caption className="sr-only">Recent services giving totals</caption>
              <THead>
                <tr>
                  <TH scope="col">Service</TH>
                  <TH scope="col" className="text-right">LRD</TH>
                  <TH scope="col" className="text-right">USD</TH>
                  <TH scope="col">Day</TH>
                </tr>
              </THead>
              <tbody>
                {recent.map(({ service, totals, closed }) => (
                  <TR key={service.id}>
                    <TD className="whitespace-nowrap">
                      <span className="font-semibold text-navy">{fmtDate(service.starts_at, "EEE d MMM")}</span>
                      <span className="block text-xs text-muted">{service.name}</span>
                    </TD>
                    <TD className="tabular whitespace-nowrap text-right">{formatAmount(totals.posted.LRD)}</TD>
                    <TD className="tabular whitespace-nowrap text-right">{formatAmount(totals.posted.USD)}</TD>
                    <TD>{closed ? <Badge tone="excused">Closed</Badge> : <Badge tone="new">Open</Badge>}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>
    </>
  );
}
