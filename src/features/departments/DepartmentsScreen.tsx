"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Search, UserMinus, UserPlus, Users } from "lucide-react";
import {
  assignToDepartment,
  departmentMembers,
  departmentSummaries,
  listMembers,
  memberStatuses,
  memberName,
  removeFromDepartment,
  setDepartmentLeader,
  sundaySeries,
  useDb,
  type DepartmentSummary,
} from "@/data/repo";
import type { Department } from "@/data/types";
import { fmtDate } from "@/lib/dates";
import { cn, initials, plural } from "@/lib/cn";
import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Dialog";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";
import { AttendanceChart } from "@/features/dashboard/AttendanceChart";
import { KpiCard } from "@/features/dashboard/KpiCard";
import { StatusCell } from "@/features/members/shared";

export function DepartmentsScreen() {
  const db = useDb();
  const { church, role, scope, can } = useChurch();
  const params = useSearchParams();
  if (!can("departments")) {
    return <NoAccess body={`${ROLES[role].label}: ${ROLES[role].limits}`} primary={{ href: churchHref(church.slug, ""), label: "Back to dashboard" }} />;
  }
  // Department heads go straight to their own department.
  const ownId = scope.kind === "department" ? scope.department.id : null;
  const id = ownId ?? params.get("id");
  const department = id ? db.departments.find((d) => d.id === id && d.church_id === church.id) : undefined;
  if (department) return <DepartmentDetail department={department} canManage={role === "pastor" || role === "secretary"} showBack={!ownId} />;

  const summaries = departmentSummaries(db, church.id);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted">{plural(summaries.length, "department")} · members can belong to several</p>
        <h1 className="mt-1 text-3xl font-extrabold">Departments</h1>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaries.map((s) => (
          <li key={s.department.id}>
            <DepartmentCard s={s} href={`${churchHref(church.slug, "departments")}?id=${s.department.id}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DepartmentCard({ s, href }: { s: DepartmentSummary; href: string }) {
  const max = Math.max(1, ...s.recent);
  const pct = s.members ? Math.round((s.lastSundayPresent / s.members) * 100) : 0;
  return (
    <Link href={href} className="flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition-[border-color,box-shadow] hover:border-navy-200 hover:shadow-raised">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold">{s.department.name}</h2>
        <span className="tabular font-heading text-2xl font-extrabold text-navy">{s.members}</span>
      </div>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted">
        {s.leader ? (
          <>
            <Avatar initials={initials(s.leader.first_name, s.leader.last_name)} size="sm" className="size-6 text-[10px]" />
            Led by {memberName(s.leader)}
          </>
        ) : (
          "No leader set"
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="active">{s.active} active</Badge>
        {s.newCount > 0 && <Badge tone="new">{s.newCount} new</Badge>}
        {s.inactive > 0 && <Badge tone="inactive">{s.inactive} inactive</Badge>}
      </div>
      <div className="mt-auto pt-4">
        <div className="flex h-10 items-end gap-1" aria-hidden>
          {s.recent.map((v, i) => (
            <span key={i} className={cn("flex-1 rounded-t-[3px]", i === s.recent.length - 1 ? "bg-gold" : "bg-teal")} style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Last Sunday: <span className="font-semibold text-navy">{s.lastSundayPresent}</span> of {s.members} present ({pct}%)
        </p>
      </div>
    </Link>
  );
}

function DepartmentDetail({ department, canManage, showBack }: { department: Department; canManage: boolean; showBack: boolean }) {
  const db = useDb();
  const { church } = useChurch();
  const [assignOpen, setAssignOpen] = useState(false);
  const summary = departmentSummaries(db, church.id, department.id)[0];
  const members = departmentMembers(db, department.id);
  const statuses = memberStatuses(db, church.id);
  const series = sundaySeries(db, church.id, 12, { kind: "department", department });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {showBack && (
            <Link href={churchHref(church.slug, "departments")} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
              <ArrowLeft className="size-4" aria-hidden /> All departments
            </Link>
          )}
          <h1 className="text-3xl font-extrabold">{department.name}</h1>
          <p className="mt-1 text-sm text-muted">{summary.leader ? `Led by ${memberName(summary.leader)}` : "No leader set yet"}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-56">
              <label htmlFor="leader" className="sr-only">
                Department leader
              </label>
              <Select
                id="leader"
                value={department.leader_member_id ?? ""}
                onChange={(e) => {
                  setDepartmentLeader(department, e.target.value || null);
                  toast("Leader updated", { body: e.target.value ? `${memberName(members.find((m) => m.id === e.target.value))} now leads ${department.name}.` : `${department.name} has no leader set.` });
                }}
              >
                <option value="">No leader</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    Leader: {memberName(m)}
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={() => setAssignOpen(true)} icon={<UserPlus className="size-4" aria-hidden />}>
              Assign members
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Members" value={summary.members} note={`${summary.active} active · ${summary.newCount} new`} noteTone="teal" />
        <KpiCard label="Present last Sunday" value={summary.lastSundayPresent} note={`${summary.members ? Math.round((summary.lastSundayPresent / summary.members) * 100) : 0}% of the department`} />
        <KpiCard label="Inactive" value={summary.inactive} tone={summary.inactive ? "danger" : "default"} note="Not seen for 6+ weeks" />
        <KpiCard label="Avg. Sunday, 6 weeks" value={Math.round(series.slice(-6).reduce((a, p) => a + p.members, 0) / Math.max(1, series.slice(-6).length))} note="Department members only" />
      </div>

      <Card className="min-w-0">
        <CardHeader title="Sunday attendance" action={<span className="text-xs text-muted">Last 12 Sundays · department members</span>} />
        <div className="px-5 pb-5">
          <AttendanceChart points={series} includesGuests={false} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Members" subtitle={plural(members.length, "member")} />
        {members.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title="No members yet" body="Assign members to this department to see them here." />
        ) : (
          <div className="mt-4">
            <Table>
              <caption className="sr-only">{department.name} members</caption>
              <THead>
                <tr>
                  <TH scope="col">Member</TH>
                  <TH scope="col">Status</TH>
                  <TH scope="col" className="hidden sm:table-cell">
                    Last attended
                  </TH>
                  {canManage && (
                    <TH scope="col">
                      <span className="sr-only">Actions</span>
                    </TH>
                  )}
                </tr>
              </THead>
              <tbody>
                {members.map((m) => {
                  const s = statuses.get(m.id)!;
                  return (
                    <TR key={m.id}>
                      <TD>
                        <Link href={`${churchHref(church.slug, "members")}?id=${m.id}`} className="flex items-center gap-3 font-semibold text-navy hover:underline">
                          <Avatar initials={initials(m.first_name, m.last_name)} size="sm" />
                          <span className="whitespace-nowrap">{memberName(m)}</span>
                          {department.leader_member_id === m.id && <Badge tone="gold">Leader</Badge>}
                        </Link>
                      </TD>
                      <TD>
                        <StatusCell status={s} />
                      </TD>
                      <TD className="hidden whitespace-nowrap text-ink sm:table-cell">{s.last_attended ? fmtDate(s.last_attended) : "Not yet"}</TD>
                      {canManage && (
                        <TD className="text-right">
                          <button
                            type="button"
                            aria-label={`Remove ${memberName(m)} from ${department.name}`}
                            title="Remove from department"
                            onClick={() => {
                              removeFromDepartment(department, m.id);
                              toast(`${memberName(m)} removed`, {
                                body: `No longer in ${department.name}.`,
                                action: { label: "Undo", onClick: () => assignToDepartment(department, [m.id]) },
                              });
                            }}
                            className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger-ink"
                          >
                            <UserMinus className="size-4" aria-hidden />
                          </button>
                        </TD>
                      )}
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
      {assignOpen && <AssignDialog department={department} onClose={() => setAssignOpen(false)} />}
    </div>
  );
}

function AssignDialog({ department, onClose }: { department: Department; onClose: () => void }) {
  const db = useDb();
  const { church } = useChurch();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const current = useMemo(() => new Set(db.member_departments.filter((md) => md.department_id === department.id).map((md) => md.member_id)), [db, department.id]);
  const candidates = useMemo(() => {
    const query = q.trim().toLowerCase();
    return listMembers(db, church.id)
      .filter((m) => !current.has(m.id))
      .filter((m) => !query || `${m.first_name} ${m.last_name}`.toLowerCase().includes(query))
      .sort((a, b) => a.first_name.localeCompare(b.first_name))
      .slice(0, 40);
  }, [db, church.id, current, q]);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign members to ${department.name}`}
      description="Members can belong to several departments."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!picked.length}
            onClick={() => {
              assignToDepartment(department, picked);
              toast(`${plural(picked.length, "member")} added`, { body: `Now in ${department.name}.` });
              onClose();
            }}
          >
            {picked.length ? `Add ${plural(picked.length, "member")}` : "Add members"}
          </Button>
        </>
      }
    >
      <div className="relative">
        <label htmlFor="assign-search" className="sr-only">
          Search members
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input id="assign-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="pl-9" autoFocus />
      </div>
      <ul className="mt-3 max-h-80 overflow-y-auto">
        {candidates.map((m) => (
          <li key={m.id} className="border-b border-line last:border-b-0">
            <Checkbox
              label={memberName(m)}
              checked={picked.includes(m.id)}
              onChange={(e) => setPicked(e.target.checked ? [...picked, m.id] : picked.filter((x) => x !== m.id))}
              className="px-1"
            />
          </li>
        ))}
        {candidates.length === 0 && <li className="py-6 text-center text-sm text-muted">No one else matches.</li>}
      </ul>
      {!q && <p className="mt-2 text-xs text-muted">Showing the first 40. Search to find anyone else.</p>}
    </Modal>
  );
}
