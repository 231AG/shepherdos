"use client";

import { CalendarCheck, CircleDollarSign, HeartHandshake, Pencil, Phone, Users } from "lucide-react";
import { useEffect } from "react";
import {
  memberAttendanceHistory,
  memberById,
  memberDepartmentsIndex,
  memberGivingSummary,
  memberName,
  memberProspectHistory,
  memberRecentAttendance,
  memberStatuses,
  useDb,
} from "@/data/repo";
import { canSeeContacts, canSeeGivingTotals } from "@/lib/access";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn, initials } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Dialog";
import { Avatar } from "@/components/ui/misc";
import { useChurch } from "@/components/shell/ChurchContext";
import { useGuideMark } from "@/components/shell/hooks";
import { GIVING_TYPE_LABEL } from "@/lib/giving";
import { PhoneText, StatusCell } from "./shared";

const EXCEPTION_LABEL = { homebound: "Homebound", leave: "Approved leave", pastoral: "Pastoral exception" } as const;
const STAGE_LABEL = { new_contact: "New contact", contacted: "Contacted", visiting: "Visiting", ready_to_join: "Ready to join", converted: "Converted" } as const;

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-5 first:border-t-0 first:pt-0">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-navy">
        <span className="text-teal-ink">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function MemberSheet({ memberId, onClose, onEdit }: { memberId: string | null; onClose: () => void; onEdit: () => void }) {
  const db = useDb();
  const { church, role, scope } = useChurch();
  const mark = useGuideMark();
  const member = memberById(db, memberId);
  useEffect(() => {
    if (member) mark("open_member");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id]);

  // Department heads can only open members of their own department.
  const inScope =
    !!member &&
    member.church_id === church.id &&
    (scope.kind === "church" || db.member_departments.some((md) => md.member_id === member.id && md.department_id === scope.department.id));
  const canEdit = role === "pastor" || role === "secretary";

  if (!member || !inScope) {
    return (
      <Sheet open={!!memberId} onClose={onClose} title="Member not available">
        <p className="text-sm text-muted">This member isn&apos;t in {scope.kind === "department" ? `the ${scope.department.name} department` : church.name}.</p>
      </Sheet>
    );
  }

  const status = memberStatuses(db, church.id).get(member.id)!;
  const departments = memberDepartmentsIndex(db, church.id).get(member.id) ?? [];
  const history = memberAttendanceHistory(db, member, 12);
  const counted = history.filter((h) => !h.beforeJoin);
  const attended = counted.filter((h) => h.attended).length;
  const recent = memberRecentAttendance(db, member, 5);
  const showGiving = canSeeGivingTotals(role, church.settings);
  const giving = showGiving ? memberGivingSummary(db, member.id) : null;
  const soul = memberProspectHistory(db, member);

  return (
    <Sheet
      open
      onClose={onClose}
      title={memberName(member)}
      description={`Member since ${fmtDate(member.joined_on, "MMMM yyyy")}${member.imported_at ? " · imported from notebook" : ""}`}
      footer={
        canEdit ? (
          <Button variant="secondary" onClick={onEdit} icon={<Pencil className="size-4" aria-hidden />}>
            Edit member
          </Button>
        ) : undefined
      }
    >
      <div className="mb-5 flex items-center gap-4">
        <Avatar initials={initials(member.first_name, member.last_name)} size="lg" tone={status.status === "inactive" ? "neutral" : "teal"} />
        <div className="min-w-0">
          <StatusCell status={status} />
          <p className="mt-1 text-xs text-muted">Last attended: {status.last_attended ? fmtDate(status.last_attended) : "not yet"}</p>
        </div>
      </div>

      {(status.status === "inactive" || member.exception) && (
        <div className={cn("mb-5 rounded-xl px-4 py-3 text-sm", member.exception ? "bg-slate-soft text-slate-ink" : "bg-danger-soft text-danger-ink")}>
          {member.exception ? (
            <>
              <span className="font-semibold">{EXCEPTION_LABEL[member.exception.kind]}.</span> {member.exception.reason}
              {member.exception.until && ` Until ${fmtDate(member.exception.until)}.`} Excused members are never marked inactive.
            </>
          ) : (
            <>
              <span className="font-semibold">No attendance for {church.settings.inactive_weeks}+ weeks.</span> Members become inactive after{" "}
              {church.settings.inactive_weeks} weeks without attending. The threshold is set in Settings.
            </>
          )}
        </div>
      )}

      <Section title="Contact" icon={<Phone className="size-4" aria-hidden />}>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-muted">Phone</dt>
            <dd className="mt-0.5 font-medium text-ink">
              <PhoneText phone={member.phone} visible={canSeeContacts(role)} />
              {canSeeContacts(role) && member.sms_opt_out && <Badge tone="excused" className="ml-2">Opted out of SMS</Badge>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Gender</dt>
            <dd className="mt-0.5 text-ink">{member.gender === "female" ? "Female" : member.gender === "male" ? "Male" : "Not recorded"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Joined</dt>
            <dd className="mt-0.5 text-ink">{fmtDate(member.joined_on)}</dd>
          </div>
          {member.household && (
            <div className="col-span-2">
              <dt className="text-xs text-muted">Household</dt>
              <dd className="mt-0.5 text-ink">{member.household}</dd>
            </div>
          )}
        </dl>
      </Section>

      <Section title="Departments" icon={<Users className="size-4" aria-hidden />}>
        {departments.length ? (
          <div className="flex flex-wrap gap-2">
            {departments.map((d) => (
              <Badge key={d.id} tone="neutral">
                {d.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Not in a department yet.</p>
        )}
      </Section>

      <Section title="Attendance" icon={<CalendarCheck className="size-4" aria-hidden />}>
        <p className="text-sm text-ink">
          Attended <span className="font-semibold">{attended}</span> of the last {counted.length} Sundays
          {counted.length < history.length ? " since joining" : ""}.
        </p>
        <ol className="mt-3 grid grid-cols-12 gap-1" aria-label="Last 12 Sundays, oldest first">
          {history.map((h) => (
            <li key={h.service.id} className="flex flex-col items-center gap-1">
              <span
                title={`${fmtDate(h.service.starts_at, "d MMM")}: ${h.beforeJoin ? "before joining" : h.attended ? "present" : "absent"}`}
                className={cn(
                  "block h-7 w-full rounded-md",
                  h.beforeJoin ? "border border-dashed border-line" : h.attended ? "bg-teal" : "bg-navy-100",
                )}
              />
              <span className="sr-only">
                {fmtDate(h.service.starts_at, "d MMMM")}: {h.beforeJoin ? "before joining" : h.attended ? "present" : "absent"}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-1 flex justify-between text-[10px] text-muted" aria-hidden>
          <span>{history[0] && fmtDate(history[0].service.starts_at, "d MMM")}</span>
          <span>{history.at(-1) && fmtDate(history.at(-1)!.service.starts_at, "d MMM")}</span>
        </div>
        {recent.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 text-sm">
            {recent.map((s) => (
              <li key={s.id} className="flex justify-between gap-3">
                <span className="text-ink">{s.name}</span>
                <span className="text-muted">{s.closed ? fmtDate(s.starts_at, "EEE d MMM") : "Open service · checked in"}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {giving && (
        <Section title={`Giving in ${fmtDate(db.now, "yyyy")}`} icon={<CircleDollarSign className="size-4" aria-hidden />}>
          {giving.count === 0 ? (
            <p className="text-sm text-muted">No named giving recorded this year.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-navy-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">LRD</p>
                  <p className="tabular mt-0.5 font-heading font-bold text-navy">{formatMoney(giving.yearTotals.LRD, "LRD")}</p>
                </div>
                <div className="rounded-xl bg-navy-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">USD</p>
                  <p className="tabular mt-0.5 font-heading font-bold text-navy">{formatMoney(giving.yearTotals.USD, "USD")}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                {giving.count} gifts. Last: {giving.last && `${GIVING_TYPE_LABEL[giving.last.type].toLowerCase()} on ${fmtDate(giving.last.created_at, "d MMM")}`}. Kept per
                currency, never added together.
              </p>
            </>
          )}
        </Section>
      )}

      {soul && (
        <Section title="Soul-winning history" icon={<HeartHandshake className="size-4" aria-hidden />}>
          <p className="text-sm text-ink">
            {soul.prospect.source}, first contact {fmtDate(soul.prospect.first_contact_on)}. Followed up by {soul.prospect.assignee_name}.{" "}
            <Badge tone="active">{STAGE_LABEL[soul.prospect.stage]}</Badge>
          </p>
          <ol className="mt-3 flex flex-col gap-3 border-l-2 border-line pl-4">
            {soul.events.map((e) => (
              <li key={e.id}>
                <p className="text-xs text-muted">
                  {fmtDate(e.created_at, "d MMM yyyy")} · {e.author_name}
                </p>
                <p className="text-sm text-ink">{e.note}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </Sheet>
  );
}
