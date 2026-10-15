"use client";

import Link from "next/link";
import { useState } from "react";
import { Upload } from "lucide-react";
import {
  listMembers,
  memberById,
  memberName,
  memberStatuses,
  statusCounts,
  useDb,
  weeklyGiving,
} from "@/data/repo";
import type { Currency } from "@/data/types";
import { STATUS_LABEL, type MemberStatus } from "@/lib/status";
import { fmtDate } from "@/lib/dates";
import { formatCompact, formatMoney } from "@/lib/money";
import { initials } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/misc";
import { Chips } from "@/components/ui/Tabs";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { useChurch } from "@/components/shell/ChurchContext";
import { churchHref } from "@/components/shell/nav";
import { GIVING_TYPE_LABEL } from "./GivingCard";

const STATUS_ORDER: MemberStatus[] = ["active", "new", "inactive", "excused"];

function StatusRow({ counts, slug }: { counts: Record<MemberStatus, number>; slug: string }) {
  return (
    <ul className="grid grid-cols-2 gap-2 px-5 pt-4">
      {STATUS_ORDER.map((s) => (
        <li key={s}>
          <Link
            href={`${churchHref(slug, "members")}?status=${s}`}
            className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 hover:border-navy-200"
          >
            <Badge tone={s}>{STATUS_LABEL[s]}</Badge>
            <span className="tabular font-heading text-lg font-bold text-navy">{counts[s]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Secretary: membership at a glance instead of giving. */
export function MembershipSnapshot() {
  const db = useDb();
  const { church, scope } = useChurch();
  const counts = statusCounts(db, church.id, scope);
  const recent = [...listMembers(db, church.id, scope)].sort((a, b) => b.joined_on.localeCompare(a.joined_on)).slice(0, 4);
  return (
    <Card className="flex flex-col">
      <CardHeader title="Membership" subtitle="Status is worked out from attendance" />
      <StatusRow counts={counts} slug={church.slug} />
      <p className="px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-muted">Recently joined</p>
      <ul className="px-5">
        {recent.map((m) => (
          <li key={m.id} className="flex items-center gap-3 border-t border-line py-2.5">
            <Avatar initials={initials(m.first_name, m.last_name)} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy">{memberName(m)}</span>
            <span className="text-xs text-muted">{fmtDate(m.joined_on, "d MMM")}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto px-5 pb-5 pt-4">
        <ButtonLink href={churchHref(church.slug, "members/import")} variant="secondary" className="w-full" icon={<Upload className="size-4" aria-hidden />}>
          Import notebook spreadsheet
        </ButtonLink>
      </div>
    </Card>
  );
}

/** Department head: their department's status and who needs attention. */
export function DepartmentSnapshot() {
  const db = useDb();
  const { church, scope } = useChurch();
  if (scope.kind !== "department") return null;
  const counts = statusCounts(db, church.id, scope);
  const statuses = memberStatuses(db, church.id);
  const attention = listMembers(db, church.id, scope)
    .filter((m) => statuses.get(m.id)!.status === "inactive")
    .slice(0, 4);
  return (
    <Card className="flex flex-col">
      <CardHeader title={`${scope.department.name} at a glance`} subtitle="Only members of your department" />
      <StatusRow counts={counts} slug={church.slug} />
      <p className="px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-muted">Not seen recently</p>
      <ul className="px-5 pb-5">
        {attention.length === 0 && <li className="py-2 text-sm text-muted">Everyone has attended recently.</li>}
        {attention.map((m) => {
          const s = statuses.get(m.id)!;
          return (
            <li key={m.id} className="flex items-center gap-3 border-t border-line py-2.5">
              <Avatar initials={initials(m.first_name, m.last_name)} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-navy">{memberName(m)}</span>
                <span className="block text-xs text-muted">{s.last_attended ? `Last attended ${fmtDate(s.last_attended, "d MMM")}` : "No attendance yet"}</span>
              </span>
              <Badge tone="inactive">{s.detail}</Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Treasurer: posted giving per Sunday, one currency at a time (never summed). */
export function GivingTrendCard() {
  const db = useDb();
  const { church } = useChurch();
  const [currency, setCurrency] = useState<Currency>("LRD");
  const weeks = weeklyGiving(db, church.id, 12);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Posted giving per week"
        subtitle="Last 12 weeks. Each currency is charted on its own."
        action={
          <Chips
            label="Currency"
            value={currency}
            onChange={setCurrency}
            items={[
              { id: "LRD", label: "LRD" },
              { id: "USD", label: "USD" },
            ]}
          />
        }
      />
      <div className="flex flex-1 flex-col justify-end px-5 pb-5">
        <ColumnChart
          height="h-56 sm:h-64 lg:h-80"
          caption={`Posted giving per week in ${currency}`}
          formatValue={(v) => formatCompact(v)}
          columns={weeks.map((w) => ({
            key: w.week.toISOString(),
            label: fmtDate(w.week, "MMM d"),
            value: w.totals[currency],
            ariaLabel: `Week of ${fmtDate(w.week, "d MMMM")}: ${formatMoney(w.totals[currency], currency)}`,
            tooltip: [`Week of ${fmtDate(w.week, "d MMM")}`, formatMoney(w.totals[currency], currency)],
          }))}
        />
      </div>
    </Card>
  );
}

/** Treasurer: most recent ledger rows, including reversals. */
export function RecentLedgerCard() {
  const db = useDb();
  const { church } = useChurch();
  const rows = db.giving_entries
    .filter((e) => e.church_id === church.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);
  const reversed = new Set(db.giving_entries.filter((r) => r.church_id === church.id && r.kind === "reversal").map((r) => r.reverses_id));
  return (
    <Card>
      <CardHeader
        title="Latest ledger entries"
        action={
          <Link href={churchHref(church.slug, "giving")} className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-ink underline underline-offset-4 md:min-h-0">
            Open ledger
          </Link>
        }
      />
      <ul className="px-5 pb-4 pt-2">
        {rows.map((e) => {
          const who = e.member_id ? memberName(memberById(db, e.member_id)) : e.giver_label;
          return (
            <li key={e.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
              <span className="tabular w-[4.5rem] shrink-0 text-xs font-semibold text-navy">{e.ref}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{who}</span>
                <span className="block text-xs text-muted">{GIVING_TYPE_LABEL[e.type]}</span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className={`tabular text-sm font-semibold ${e.kind === "reversal" ? "text-danger-ink" : "text-navy"}`}>
                  {formatMoney(e.kind === "reversal" ? -e.amount_minor : e.amount_minor, e.currency)}
                </span>
                {e.kind === "reversal" ? (
                  <Badge tone="inactive">Reversal</Badge>
                ) : reversed.has(e.id) ? (
                  <Badge tone="outline">Posted · reversed</Badge>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
