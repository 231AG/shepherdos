"use client";

import { useEffect } from "react";
import { CircleDollarSign, FileClock, ScanLine, Upload, UserPlus, Users } from "lucide-react";
import { dashboardStats, givingSummary, monthRange, sundaySeries, useDb } from "@/data/repo";
import { canAccess } from "@/lib/access";
import { fmtDate, greeting } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useChurch } from "@/components/shell/ChurchContext";
import { churchHref } from "@/components/shell/nav";
import { useGuideMark } from "@/components/shell/hooks";
import { AttendanceChart } from "./AttendanceChart";
import { EventsCard } from "./EventsCard";
import { GivingCard } from "./GivingCard";
import { KpiCard } from "./KpiCard";
import { DepartmentSnapshot, GivingTrendCard, MembershipSnapshot, RecentLedgerCard } from "./SnapshotCards";
import { TasksCard } from "./TasksCard";

function greetingName(display: string): string {
  const m = /^(Rev\.|Deacon|Sis\.|Bro\.)\s+\S+\s+(.+)$/.exec(display);
  if (m) return `${m[1]} ${m[2]}`;
  return display.split(" ")[0];
}

export function DashboardScreen() {
  const db = useDb();
  const { church, role, persona, scope } = useChurch();
  const mark = useGuideMark();
  useEffect(() => {
    mark("view_dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, church.id]);

  const s = dashboardStats(db, church.id, scope);
  const href = (p: string) => churchHref(church.slug, p);
  const isDept = scope.kind === "department";

  const actions: { label: string; href: string; icon: React.ReactNode }[] = [];
  if (role === "treasurer") {
    actions.push({ label: "Record giving", href: href("giving"), icon: <CircleDollarSign className="size-4" aria-hidden /> });
    actions.push({ label: "Review drafts", href: `${href("giving")}?drafts=1`, icon: <FileClock className="size-4" aria-hidden /> });
  } else {
    if (canAccess(role, "attendance")) actions.push({ label: "Start check-in", href: href("attendance/check-in"), icon: <ScanLine className="size-4" aria-hidden /> });
    if (role === "pastor" && canAccess(role, "giving", church.settings))
      actions.push({ label: "Record giving", href: href("giving"), icon: <CircleDollarSign className="size-4" aria-hidden /> });
    if (role === "pastor" || role === "secretary") actions.push({ label: "Add member", href: `${href("members")}?new=1`, icon: <UserPlus className="size-4" aria-hidden /> });
    if (role === "secretary") actions.push({ label: "Import", href: href("members/import"), icon: <Upload className="size-4" aria-hidden /> });
    if (isDept) actions.push({ label: `${scope.department.name} members`, href: href("members"), icon: <Users className="size-4" aria-hidden /> });
  }

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted">{fmtDate(db.now, "EEEE, d MMMM yyyy")}</p>
          <h1 className="mt-1 text-[26px] font-extrabold leading-tight sm:text-3xl">
            {greeting(new Date())}, {greetingName(persona.display)}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a, i) => (
            <ButtonLink key={a.label} href={a.href} variant={i === 0 ? "primary" : "secondary"} icon={a.icon} className="shrink-0">
              {a.label}
            </ButtonLink>
          ))}
        </div>
      </div>

      {isDept && (
        <div className="rounded-2xl border border-navy-100 bg-navy-50 px-4 py-3 text-sm text-navy">
          <span className="font-semibold">You&apos;re seeing the {scope.department.name} department only.</span>{" "}
          {s.members} members are in your department. Other members, guests and all giving are hidden for your role.
        </div>
      )}

      {role === "treasurer" ? <TreasurerBody /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard
              label={isDept ? `${scope.department.name} members` : "Members"}
              value={s.members.toLocaleString("en-US")}
              note={s.joinedThisMonth > 0 ? `+${s.joinedThisMonth} joined this month` : "No new joiners this month"}
              noteTone={s.joinedThisMonth > 0 ? "teal" : "muted"}
              href={href("members")}
            />
            <KpiCard
              label={
                <>
                  <span className="sm:hidden">Avg. attendance</span>
                  <span className="hidden sm:inline">Avg. Sunday attendance</span>
                </>
              }
              value={s.avgAttendance.toLocaleString("en-US")}
              note={s.avgIncludesGuests ? "Last 6 weeks, incl. guests" : "Last 6 weeks, department members"}
              href={href("attendance")}
            />
            <KpiCard label="New members" value={s.statusCounts.new} note="Joined in the last 28 days" href={`${href("members")}?status=new`} />
            <KpiCard
              label="Inactive"
              value={s.statusCounts.inactive}
              tone="danger"
              note={`${church.settings.inactive_weeks}+ weeks absent · ${s.statusCounts.excused} excused`}
              href={`${href("members")}?status=inactive`}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
            <Card className="flex min-w-0 flex-col lg:col-span-3">
              <CardHeader
                title={isDept ? `${scope.department.name} Sunday attendance` : "Sunday attendance"}
                action={<span className="text-xs text-muted">Last 12 Sundays · {isDept ? "members" : "members + guests"}</span>}
              />
              <div className="flex flex-1 flex-col justify-end px-5 pb-5">
                <AttendanceChart points={sundaySeries(db, church.id, 12, scope)} includesGuests={!isDept} />
              </div>
            </Card>
            <div className="min-w-0 lg:col-span-2">
              {role === "secretary" ? <MembershipSnapshot /> : isDept ? <DepartmentSnapshot /> : <GivingCard />}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
            <div className="min-w-0 lg:col-span-3">
              <TasksCard />
            </div>
            <div className="min-w-0 lg:col-span-2">
              <EventsCard />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TreasurerBody() {
  const db = useDb();
  const { church } = useChurch();
  const mark = useGuideMark();
  const g = givingSummary(db, church.id, monthRange(db.now));
  const href = (p: string) => churchHref(church.slug, p);
  const month = fmtDate(db.now, "MMMM");
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label={`Posted LRD · ${month}`} value={formatAmount(g.posted.LRD)} note="Posted entries minus reversals" href={href("giving")} />
        <KpiCard label={`Posted USD · ${month}`} value={formatAmount(g.posted.USD)} note="Kept separate from LRD" href={href("giving")} />
        <KpiCard
          label="Offline drafts"
          value={g.drafts.count}
          tone={g.drafts.count > 0 ? "gold" : "default"}
          note={g.drafts.count > 0 ? "Not in totals · review before close" : "Nothing waiting for review"}
          noteTone={g.drafts.count > 0 ? "gold" : "muted"}
          href={`${href("giving")}?drafts=1`}
          onClick={() => mark("view_drafts")}
        />
        <KpiCard label={`Entries · ${month}`} value={g.entryCount} note="Posted ledger rows this month" href={href("giving")} />
      </div>
      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <div className="min-w-0 lg:col-span-3">
          <GivingTrendCard />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <GivingCard />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <div className="min-w-0 lg:col-span-3">
          <RecentLedgerCard />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <EventsCard />
        </div>
      </div>
    </>
  );
}
