"use client";

import Link from "next/link";
import { EyeOff } from "lucide-react";
import { givingSummary, monthRange, useDb } from "@/data/repo";
import { GIVING_TYPES } from "@/data/types";
import { GIVING_TYPE_LABEL } from "@/lib/giving";
import { canSeeLedger } from "@/lib/access";
import { formatAmount, formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { Card, CardHeader } from "@/components/ui/Card";
import { useChurch } from "@/components/shell/ChurchContext";
import { churchHref } from "@/components/shell/nav";

/** This month's giving. LRD and USD are shown side by side, never added together. */
export function GivingCard() {
  const db = useDb();
  const { church, role } = useChurch();
  const visibility = church.settings.pastor_giving_visibility;

  if (role === "pastor" && visibility === "none") {
    return (
      <Card className="flex flex-col">
        <CardHeader title={`Giving · ${fmtDate(db.now, "MMMM")}`} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <EyeOff className="size-6 text-muted" aria-hidden />
          <p className="mt-3 font-semibold text-navy">Giving is hidden for the Pastor role</p>
          <p className="mt-1 max-w-xs text-sm text-muted">This church has set pastor access to giving to &ldquo;none&rdquo;.</p>
          <Link href={churchHref(church.slug, "settings")} className="mt-3 text-sm font-semibold text-teal-ink underline underline-offset-4">
            Change in Settings
          </Link>
        </div>
      </Card>
    );
  }

  const s = givingSummary(db, church.id, monthRange(db.now));
  const ledger = canSeeLedger(role, church.settings);
  const rows = GIVING_TYPES.filter((t) => s.byType[t].LRD !== 0 || s.byType[t].USD !== 0);

  return (
    <Card className="flex flex-col">
      <CardHeader
        title={`Giving · ${fmtDate(db.now, "MMMM")}`}
        action={
          <Link href={churchHref(church.slug, "giving")} className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-ink underline underline-offset-4 md:min-h-0">
            {ledger ? "Open ledger" : "Giving summary"}
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 px-5 pt-4">
        <div className="rounded-xl bg-navy p-3.5 text-white sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Posted · LRD</p>
          <p className="mt-1 font-heading text-xl font-extrabold sm:text-2xl">{formatAmount(s.posted.LRD)}</p>
        </div>
        <div className="rounded-xl bg-navy-50 p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Posted · USD</p>
          <p className="mt-1 font-heading text-xl font-extrabold text-navy sm:text-2xl">{formatAmount(s.posted.USD)}</p>
        </div>
      </div>
      <div className="px-5 pt-3">
        <table className="w-full text-sm">
          <caption className="sr-only">Giving by type this month, per currency</caption>
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted">
              <th scope="col" className="py-2 text-left font-semibold">Type</th>
              <th scope="col" className="py-2 text-right font-semibold">LRD</th>
              <th scope="col" className="py-2 text-right font-semibold">USD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t} className="border-t border-line">
                <th scope="row" className="py-2.5 text-left font-medium text-ink">
                  {GIVING_TYPE_LABEL[t]}
                </th>
                <td className="tabular py-2.5 text-right text-ink">{formatAmount(s.byType[t].LRD)}</td>
                <td className="tabular py-2.5 text-right text-ink">{formatAmount(s.byType[t].USD)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s.drafts.count > 0 && role === "treasurer" && (
        <div className="mx-5 mt-3 rounded-xl border border-gold/70 bg-gold-soft px-3 py-2.5 text-xs text-gold-ink">
          <span className="font-semibold">{s.drafts.count} offline drafts, not in totals:</span> {formatMoney(s.drafts.totals.LRD, "LRD")} and{" "}
          {formatMoney(s.drafts.totals.USD, "USD")}
        </div>
      )}
      <p className="mt-auto px-5 pb-5 pt-3 text-xs text-muted">
        Currencies are kept separate. No combined total is shown without a labelled conversion.
        {role === "pastor" && !ledger && " Pastor view shows totals only, per church setting."}
      </p>
    </Card>
  );
}
