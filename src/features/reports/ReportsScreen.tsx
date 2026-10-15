"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { endOfMonth, format, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from "date-fns";
import { Download, Printer } from "lucide-react";
import {
  attendanceCsv,
  attendanceReport,
  givingReport,
  memberById,
  memberName,
  membershipCsv,
  membershipReport,
  memberStatuses,
  memberDepartmentsIndex,
  reportDataStart,
  useDb,
  type DateRange,
} from "@/data/repo";
import { CURRENCIES, GIVING_TYPES, type Currency } from "@/data/types";
import { canSeeContacts, canSeeGivingTotals, canSeeLedger } from "@/lib/access";
import { downloadCsv } from "@/lib/csv";
import { fmtDate, toISODate } from "@/lib/dates";
import { GIVING_TYPE_LABEL, GIVING_TYPE_SINGULAR } from "@/lib/giving";
import { formatCompact, formatMoney } from "@/lib/money";
import { ROLES } from "@/lib/roles";
import { STATUS_LABEL, type MemberStatus } from "@/lib/status";
import { cn, plural } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Chips, Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";
import { toast } from "@/components/ui/Toast";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";
import { useGuideMark } from "@/components/shell/hooks";
import { KpiCard } from "@/features/dashboard/KpiCard";
import { StatusCell } from "@/features/members/shared";

type ReportId = "membership" | "attendance" | "giving";
type Preset = "4w" | "month" | "last_month" | "3m" | "6m" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "4w", label: "Last 4 weeks" },
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "3m", label: "Last 3 months" },
  { id: "6m", label: "Last 6 months" },
  { id: "custom", label: "Custom" },
];

const REPORT_TITLE: Record<ReportId, string> = {
  membership: "Membership report",
  attendance: "Attendance report",
  giving: "Giving report",
};

/** Rolling presets start on a Sunday, so weekly charts have no half-empty first week. */
function presetRange(p: Exclude<Preset, "custom">, now: Date): DateRange {
  switch (p) {
    case "4w":
      return { from: startOfWeek(subWeeks(now, 3)), to: now };
    case "month":
      return { from: startOfMonth(now), to: now };
    case "last_month": {
      const m = subMonths(now, 1);
      return { from: startOfMonth(m), to: endOfMonth(m) };
    }
    case "3m":
      return { from: startOfWeek(subWeeks(now, 12)), to: now };
    case "6m":
      return { from: startOfWeek(subWeeks(now, 25)), to: now };
  }
}

export function ReportsScreen() {
  const db = useDb();
  const { church, role, persona, can } = useChurch();
  const params = useSearchParams();
  const mark = useGuideMark();

  const available = useMemo(() => {
    const out: ReportId[] = ["membership"];
    if (role !== "treasurer") out.push("attendance");
    if (canSeeGivingTotals(role, church.settings)) out.push("giving");
    return out;
  }, [role, church.settings]);
  const wanted = params.get("report") as ReportId | null;
  const [tab, setTab] = useState<ReportId>(
    wanted && available.includes(wanted) ? wanted : role === "treasurer" ? "giving" : "membership",
  );
  const [preset, setPreset] = useState<Preset>("3m");
  const [custom, setCustom] = useState(() => ({ from: toISODate(subDays(db.now, 27)), to: toISODate(db.now) }));

  if (!can("reports")) {
    return <NoAccess body={`${ROLES[role].label}: ${ROLES[role].limits}`} primary={{ href: churchHref(church.slug, ""), label: "Back to dashboard" }} />;
  }
  const active = available.includes(tab) ? tab : available[0];

  const dataStart = reportDataStart(db, church.id);
  const customError =
    !custom.from || !custom.to ? "Choose both dates." : custom.from > custom.to ? "The start date is after the end date." : null;
  const range: DateRange =
    preset === "custom"
      ? customError
        ? presetRange("4w", db.now)
        : { from: new Date(`${custom.from}T00:00:00`), to: new Date(`${custom.to}T23:59:59`) }
      : presetRange(preset, db.now);
  const rangeLabel = `${fmtDate(range.from)} to ${fmtDate(range.to)}`;
  const fileRange = `${toISODate(range.from)}_${toISODate(range.to)}`;

  const exportCsv = () => {
    if (active === "membership") {
      downloadCsv(`members_${church.slug}_${toISODate(db.now)}.csv`, membershipCsv(db, church.id, canSeeContacts(role)));
      toast("Membership list exported", { body: canSeeContacts(role) ? "One row per member, with status and departments." : "Phone numbers are left out for your role." });
    } else if (active === "attendance") {
      downloadCsv(`attendance_${church.slug}_${fileRange}.csv`, attendanceCsv(attendanceReport(db, church.id, range)));
      toast("Attendance exported", { body: "One row per service in the selected dates." });
    } else {
      const report = givingReport(db, church.id, range);
      if (canSeeLedger(role, church.settings)) {
        downloadCsv(`giving_${church.slug}_${fileRange}.csv`, [
          ["Ref", "Date", "Time", "Giver", "Type", "Currency", "Amount", "Kind", "Reason", "Recorded by"],
          ...report.rows.map((e) => [
            e.ref,
            fmtDate(e.created_at, "yyyy-MM-dd"),
            fmtDate(e.created_at, "HH:mm"),
            e.member_id ? memberName(memberById(db, e.member_id)) : (e.giver_label ?? ""),
            GIVING_TYPE_SINGULAR[e.type],
            e.currency,
            ((e.kind === "reversal" ? -e.amount_minor : e.amount_minor) / 100).toFixed(2),
            e.kind === "reversal" ? "Reversal" : "Posted",
            e.reason ?? "",
            e.actor_name,
          ]),
        ]);
        toast("Giving exported", { body: "Every posted entry and reversal, each in its own currency." });
      } else {
        downloadCsv(`giving_totals_${church.slug}_${fileRange}.csv`, [
          ["Type", "LRD", "USD"],
          ...GIVING_TYPES.map((t) => [GIVING_TYPE_LABEL[t], (report.byType[t].LRD / 100).toFixed(2), (report.byType[t].USD / 100).toFixed(2)]),
          ["Net total", (report.net.LRD / 100).toFixed(2), (report.net.USD / 100).toFixed(2)],
        ]);
        toast("Giving totals exported", { body: "Totals only, as the church's setting allows for pastors." });
      }
      mark("export_csv");
    }
  };

  const print = () => {
    // Let the print view render before the browser's print dialog opens.
    requestAnimationFrame(() => window.print());
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Printed header: only on paper. */}
      <div className="hidden border-b border-line pb-3 print:block">
        <p className="text-sm text-muted">
          {church.name} · {[church.address, church.city].filter(Boolean).join(", ")}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">{REPORT_TITLE[active]}</h1>
        <p className="mt-1 text-sm text-ink">
          {active === "membership" ? `Joined between ${rangeLabel}. Status as of ${fmtDate(db.now)}.` : rangeLabel}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Printed {format(new Date(), "d MMM yyyy, h:mm a")} by {persona.display} ({ROLES[role].short})
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <p className="text-sm text-muted">{church.short_name} · {rangeLabel}</p>
          <h1 className="mt-1 text-3xl font-extrabold">Reports</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} onClick={exportCsv}>
            Export CSV
          </Button>
          <Button variant="secondary" icon={<Printer className="size-4" aria-hidden />} onClick={print}>
            Print or save PDF
          </Button>
        </div>
      </div>

      <Card className="flex flex-col gap-4 p-4 sm:p-5 print:hidden">
        <Chips label="Date range" items={PRESETS} value={preset} onChange={setPreset} />
        {preset === "custom" && (
          <div className="grid gap-3 sm:max-w-md sm:grid-cols-2">
            <Field label="From" error={customError && custom.from > custom.to ? customError : null}>
              {(p) => (
                <Input {...p} type="date" value={custom.from} min={toISODate(dataStart)} max={custom.to || toISODate(db.now)} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              )}
            </Field>
            <Field label="To">
              {(p) => <Input {...p} type="date" value={custom.to} min={custom.from} max={toISODate(db.now)} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />}
            </Field>
            <p className="text-xs text-muted sm:col-span-2">Records in this church start on {fmtDate(dataStart)}.</p>
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Tabs
          label="Report"
          items={available.map((id) => ({ id, label: id === "membership" ? "Membership" : id === "attendance" ? "Attendance" : "Giving" }))}
          value={active}
          onChange={setTab}
          className="self-start"
        />
        {!available.includes("giving") && (
          <p className="text-sm text-muted">
            {role === "pastor" ? "Giving reports are turned off for pastors in Settings." : "Financial reports are for the pastor and treasurer."}
          </p>
        )}
      </div>

      {active === "membership" && <MembershipReportView range={range} />}
      {active === "attendance" && <AttendanceReportView range={range} />}
      {active === "giving" && <GivingReportView range={range} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Membership                                                          */
/* ------------------------------------------------------------------ */

const STATUS_ORDER: MemberStatus[] = ["active", "new", "inactive", "excused"];
const STATUS_FILL: Record<MemberStatus, string> = { active: "bg-teal", new: "bg-gold", inactive: "bg-danger", excused: "bg-navy-200" };

function MembershipReportView({ range }: { range: DateRange }) {
  const db = useDb();
  const { church, role } = useChurch();
  const [showAll, setShowAll] = useState(false);
  const r = membershipReport(db, church.id, range);
  const statuses = memberStatuses(db, church.id);
  const depts = memberDepartmentsIndex(db, church.id);
  const total = STATUS_ORDER.reduce((s, k) => s + r.status[k], 0);
  const growth = r.totalAtEnd - r.totalAtStart;
  const maxDept = Math.max(1, ...r.departments.map((d) => d.count));
  const joined = showAll ? r.joined : r.joined.slice(0, 8);
  const { new_days, inactive_weeks } = church.settings;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Members" value={r.totalAtEnd.toLocaleString("en-US")} note={`${growth >= 0 ? "+" : ""}${growth} in this period`} noteTone={growth > 0 ? "teal" : "muted"} />
        <KpiCard label="Joined" value={r.joined.length} note={`${r.converted} from soul-winning · ${r.imported} imported`} />
        <KpiCard label="Active today" value={`${total ? Math.round((r.status.active / total) * 100) : 0}%`} note={`${r.status.active.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} members`} />
        <KpiCard label="Inactive today" value={r.status.inactive} tone={r.status.inactive ? "danger" : "default"} note={`No attendance for ${inactive_weeks}+ weeks`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="New members" subtitle={`Joined per ${r.joinedByBucket[0]?.bucket.unit ?? "week"}`} />
          <div className="px-5 pb-5">
            {r.joined.length === 0 ? (
              <EmptyState title="No one joined in these dates" body="Try a longer date range." />
            ) : (
              <ColumnChart
                caption="New members per period"
                height="h-48 sm:h-56"
                columns={r.joinedByBucket.map(({ bucket, count }) => ({
                  key: bucket.key,
                  label: bucket.label,
                  value: count,
                  ariaLabel: `${bucket.title}: ${plural(count, "new member")}`,
                  tooltip: [bucket.title, plural(count, "new member")],
                }))}
              />
            )}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Status today" subtitle={`New for ${new_days} days · inactive after ${inactive_weeks} weeks`} />
          <div className="px-5 pb-5 pt-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-navy-50" aria-hidden>
              {STATUS_ORDER.map((s) => (
                <span key={s} className={STATUS_FILL[s]} style={{ width: `${total ? (r.status[s] / total) * 100 : 0}%` }} />
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-3">
              {STATUS_ORDER.map((s) => (
                <li key={s} className="flex items-center gap-2 text-sm">
                  <span className={cn("size-2.5 shrink-0 rounded-full", STATUS_FILL[s])} aria-hidden />
                  <span className="text-muted">{STATUS_LABEL[s]}</span>
                  <span className="tabular ml-auto font-semibold text-navy">{r.status[s].toLocaleString("en-US")}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-sm font-semibold text-navy">Gender</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                {(["female", "male", "unknown"] as const).map((g) => (
                  <div key={g}>
                    <dt className="text-muted">{g === "unknown" ? "Not recorded" : g === "female" ? "Women" : "Men"}</dt>
                    <dd className="tabular font-semibold text-navy">{r.gender[g].toLocaleString("en-US")}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {role === "pastor" && (
              <Link href={churchHref(church.slug, "settings")} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-teal-ink underline underline-offset-4 md:min-h-0 print:hidden">
                Change thresholds in Settings
              </Link>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="self-start lg:col-span-2">
          <CardHeader title="Departments" subtitle="Members can belong to several" />
          <ul className="flex flex-col gap-3 px-5 pb-5 pt-4">
            {r.departments.map((d) => (
              <li key={d.name} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate text-ink">{d.name}</span>
                <span className="h-2 rounded-full bg-navy-50" aria-hidden>
                  <span className="block h-2 rounded-full bg-teal" style={{ width: `${(d.count / maxDept) * 100}%` }} />
                </span>
                <span className="tabular w-8 text-right font-semibold text-navy">{d.count}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Joined in this period" subtitle={plural(r.joined.length, "member")} />
          {r.joined.length === 0 ? (
            <EmptyState title="No new members" body="Nobody joined between these dates." />
          ) : (
            <div className="mt-3">
              <Table>
                <THead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Joined</TH>
                    <TH>Status</TH>
                    <TH className="hidden sm:table-cell">Departments</TH>
                  </tr>
                </THead>
                <tbody>
                  {joined.map((m) => (
                    <TR key={m.id}>
                      <TD>
                        <Link href={`${churchHref(church.slug, "members")}?id=${m.id}`} className="font-semibold text-navy hover:underline">
                          {memberName(m)}
                        </Link>
                      </TD>
                      <TD className="tabular whitespace-nowrap text-muted">{fmtDate(m.joined_on, "d MMM")}</TD>
                      <TD>
                        <StatusCell status={statuses.get(m.id)!} />
                      </TD>
                      <TD className="hidden text-muted sm:table-cell">{(depts.get(m.id) ?? []).map((d) => d.short_name).join(", ") || "None yet"}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
              {r.joined.length > 8 && (
                <div className="border-t border-line px-5 py-3 print:hidden">
                  <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? "Show fewer" : `Show all ${r.joined.length}`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

function AttendanceReportView({ range }: { range: DateRange }) {
  const db = useDb();
  const { church } = useChurch();
  const [showAll, setShowAll] = useState(false);
  const r = attendanceReport(db, church.id, range);
  const reach = r.memberCount ? Math.round((r.uniqueMembers / r.memberCount) * 100) : 0;
  const rows = [...r.services].reverse();
  const shown = showAll ? rows : rows.slice(0, 10);

  if (r.services.length === 0) {
    return (
      <Card>
        <EmptyState title="No closed services in these dates" body="Attendance counts once a service is closed. Try a longer date range." />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Average Sunday" value={r.sundayAvg} note={`${r.sundayAvgMembers} members + ${r.sundayAvgGuests} guests`} />
        <KpiCard label="Highest Sunday" value={r.peak?.total ?? 0} note={r.peak ? fmtDate(r.peak.service.starts_at) : "No Sundays"} noteTone="teal" />
        <KpiCard label="Midweek average" value={r.midweekAvg ?? "None"} note={r.midweekAvg === null ? "No midweek services" : "Bible study and prayer"} />
        <KpiCard label="Members reached" value={`${reach}%`} note={`${r.uniqueMembers} of ${r.memberCount} came at least once`} />
      </div>

      <Card>
        <CardHeader title="Sunday attendance" subtitle={`${plural(r.sundays.length, "Sunday")} · members and guests`} />
        <div className="px-5 pb-5">
          <ColumnChart
            caption="Sunday attendance"
            columns={r.sundays.map((p) => ({
              key: p.service.id,
              label: fmtDate(p.service.starts_at, "MMM d"),
              value: p.total,
              ariaLabel: `${fmtDate(p.service.starts_at, "d MMMM")}: ${p.total} present, ${p.members} members and ${p.guests} guests`,
              tooltip: [fmtDate(p.service.starts_at, "EEE d MMM"), `${p.total} present`, `${p.members} members · ${p.guests} guests`],
            }))}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Every service" subtitle={plural(r.services.length, "service")} />
        <div className="mt-3">
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Service</TH>
                <TH className="text-right">Members</TH>
                <TH className="text-right">Guests</TH>
                <TH className="text-right">Total</TH>
              </tr>
            </THead>
            <tbody>
              {shown.map((row) => (
                <TR key={row.service.id}>
                  <TD className="tabular whitespace-nowrap text-muted">{fmtDate(row.service.starts_at, "EEE d MMM")}</TD>
                  <TD className="min-w-40 font-semibold text-navy">{row.service.name}</TD>
                  <TD className="tabular text-right">{row.members}</TD>
                  <TD className="tabular text-right">{row.guests}</TD>
                  <TD className="tabular text-right font-semibold text-navy">{row.total}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          {rows.length > 10 && (
            <div className="border-t border-line px-5 py-3 print:hidden">
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show fewer" : `Show all ${rows.length}`}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Giving                                                              */
/* ------------------------------------------------------------------ */

function GivingReportView({ range }: { range: DateRange }) {
  const db = useDb();
  const { church, role } = useChurch();
  const r = givingReport(db, church.id, range);
  const ledger = canSeeLedger(role, church.settings);
  const noEntries = r.entries.LRD + r.entries.USD === 0;

  if (noEntries) {
    return (
      <Card>
        <EmptyState title="No giving recorded in these dates" body="Try a longer date range." />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CURRENCIES.map((c) => (
          <CurrencySummary key={c} currency={c} net={r.net[c]} gross={r.gross[c]} reversed={r.reversed[c]} entries={r.entries[c]} reversals={r.reversals[c]} />
        ))}
      </div>
      <p className="-mt-1 text-sm text-muted">
        LRD and USD are reported separately and never added together.
        {r.pendingDrafts > 0 && ` ${plural(r.pendingDrafts, "offline draft")} waiting for review ${r.pendingDrafts === 1 ? "is" : "are"} not included.`}
        {!ledger && " Pastors see totals only, as set in Settings."}
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {CURRENCIES.map((c) => (
          <Card key={c}>
            <CardHeader title={`${c} by ${r.byBucket[0]?.bucket.unit ?? "week"}`} subtitle="Net of reversals" />
            <div className="px-5 pb-5">
              <ColumnChart
                caption={`${c} giving per week`}
                height="h-48 sm:h-56"
                formatValue={formatCompact}
                columns={r.byBucket.map(({ bucket, totals }) => ({
                  key: bucket.key,
                  label: bucket.label,
                  value: Math.max(0, totals[c]),
                  ariaLabel: `${bucket.title}: ${formatMoney(totals[c], c)}`,
                  tooltip: [bucket.title, formatMoney(totals[c], c)],
                }))}
              />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="By giving type" subtitle="Net of reversals, per currency" />
        <div className="mt-3">
          <Table>
            <THead>
              <tr>
                <TH>Type</TH>
                <TH className="text-right">LRD</TH>
                <TH className="text-right">USD</TH>
              </tr>
            </THead>
            <tbody>
              {GIVING_TYPES.map((t) => (
                <TR key={t}>
                  <TD className="font-semibold text-navy">{GIVING_TYPE_LABEL[t]}</TD>
                  <TD className="tabular whitespace-nowrap text-right">{formatMoney(r.byType[t].LRD, "LRD")}</TD>
                  <TD className="tabular whitespace-nowrap text-right">{formatMoney(r.byType[t].USD, "USD")}</TD>
                </TR>
              ))}
              <TR className="bg-cloud">
                <TD className="font-bold text-navy">Net total</TD>
                <TD className="tabular whitespace-nowrap text-right font-bold text-navy">{formatMoney(r.net.LRD, "LRD")}</TD>
                <TD className="tabular whitespace-nowrap text-right font-bold text-navy">{formatMoney(r.net.USD, "USD")}</TD>
              </TR>
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function CurrencySummary({
  currency,
  net,
  gross,
  reversed,
  entries,
  reversals,
}: {
  currency: Currency;
  net: number;
  gross: number;
  reversed: number;
  entries: number;
  reversals: number;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{currency === "LRD" ? "Liberian dollars" : "US dollars"} · net</p>
      <p className="tabular mt-1.5 font-heading text-[28px] font-extrabold leading-none text-navy sm:text-[32px]">{formatMoney(net, currency)}</p>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
        <Stat label="Posted" value={formatMoney(gross, currency).replace(`${currency} `, "")} note={plural(entries, "entry", "entries")} />
        <Stat label="Reversed" value={reversed ? `−${formatMoney(reversed, currency).replace(`${currency} `, "")}` : "0.00"} note={plural(reversals, "reversal")} />
        <Stat label="Average gift" value={entries ? formatCompact(Math.round(gross / entries)) : "0"} note={currency} />
      </dl>
    </Card>
  );
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular truncate font-semibold text-navy">{value}</dd>
      <dd className="text-xs text-muted">{note}</dd>
    </div>
  );
}
