"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EyeOff, Search, Upload, UserPlus, Users } from "lucide-react";
import { listDepartments, listMemberRows, memberById, statusCounts, useDb, type MemberRow } from "@/data/repo";
import type { MemberStatus } from "@/lib/status";
import { STATUS_LABEL } from "@/lib/status";
import { canSeeContacts } from "@/lib/access";
import { initials, plural } from "@/lib/cn";
import { fmtDate } from "@/lib/dates";
import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Chips } from "@/components/ui/Tabs";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";
import { useGuideMark } from "@/components/shell/hooks";
import { MemberForm } from "./MemberForm";
import { MemberSheet } from "./MemberSheet";
import { lastAttendedText, PhoneText, STATUS_FILTERS, StatusCell } from "./shared";

const PAGE = 30;

export function MembersScreen() {
  const db = useDb();
  const { church, role, scope, can } = useChurch();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mark = useGuideMark();

  const initialStatus = params.get("status") as MemberStatus | null;
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<MemberStatus | "all">(initialStatus && STATUS_FILTERS.includes(initialStatus) ? initialStatus : "all");
  const [dept, setDept] = useState<string>("all");
  const [limit, setLimit] = useState(PAGE);
  const [formFor, setFormFor] = useState<"new" | string | null>(params.get("new") ? "new" : null);
  const openId = params.get("id");

  // Keep the search box in step with the header search.
  const paramQ = params.get("q") ?? "";
  const [lastParamQ, setLastParamQ] = useState(paramQ);
  if (paramQ !== lastParamQ) {
    setLastParamQ(paramQ);
    setQ(paramQ);
  }

  const contacts = canSeeContacts(role);
  const canEdit = role === "pastor" || role === "secretary";
  const departments = listDepartments(db, church.id);

  useEffect(() => {
    if (role === "treasurer") mark("hidden_contacts");
    if (role === "dept_head") mark("youth_members");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const rows = useMemo(
    () => listMemberRows(db, church.id, scope, { q, status, departmentId: dept, allowPhoneSearch: contacts }),
    [db, church.id, scope, q, status, dept, contacts],
  );
  const counts = statusCounts(db, church.id, scope);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    ["new", "import"].forEach((k) => next.delete(k));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const openMember = (id: string) => setParam("id", id);

  if (!can("members")) {
    return <NoAccess body={`${ROLES[role].label}: ${ROLES[role].limits}`} primary={{ href: churchHref(church.slug, ""), label: "Back to dashboard" }} />;
  }

  const shown = rows.slice(0, limit);
  const editing = formFor && formFor !== "new" ? memberById(db, formFor) ?? null : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {scope.kind === "department"
              ? `${plural(total, "member")} in ${scope.department.name}`
              : `${plural(total, "member")} · ${plural(departments.length, "department")}`}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold">Members</h1>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={churchHref(church.slug, "members/import")} variant="secondary" icon={<Upload className="size-4" aria-hidden />}>
              Import spreadsheet
            </ButtonLink>
            <Button onClick={() => setFormFor("new")} icon={<UserPlus className="size-4" aria-hidden />}>
              Add member
            </Button>
          </div>
        )}
      </div>

      {scope.kind === "department" && (
        <div className="rounded-2xl border border-navy-100 bg-navy-50 px-4 py-3 text-sm text-navy">
          <span className="font-semibold">You&apos;re seeing the {scope.department.name} department only.</span> Members of other departments are hidden for your role.
        </div>
      )}
      {!contacts && (
        <div className="flex items-start gap-3 rounded-2xl border border-navy-100 bg-navy-50 px-4 py-3 text-sm text-navy">
          <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Contact details hidden for your role.</span> Treasurers see member names for giving records, but not phone
            numbers.
          </p>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[17px] font-bold">Directory</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-64">
              <label htmlFor="member-search" className="sr-only">
                {contacts ? "Search by name or phone" : "Search by name"}
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                id="member-search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder={contacts ? "Name or last 4 digits" : "Name"}
                className="pl-9"
                type="search"
              />
            </div>
            {scope.kind === "church" && (
              <div className="sm:w-52">
                <label htmlFor="dept-filter" className="sr-only">
                  Department
                </label>
                <Select
                  id="dept-filter"
                  value={dept}
                  onChange={(e) => {
                    setDept(e.target.value);
                    setLimit(PAGE);
                  }}
                >
                  <option value="all">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                  <option value="none">Unassigned</option>
                </Select>
              </div>
            )}
          </div>
        </div>
        <div className="border-b border-line px-4 py-3">
          <Chips
            label="Filter by status"
            value={status}
            onChange={(s) => {
              setStatus(s);
              setLimit(PAGE);
            }}
            items={STATUS_FILTERS.map((s) => ({ id: s, label: s === "all" ? "All" : STATUS_LABEL[s], count: s === "all" ? total : counts[s] }))}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No members match"
            body={q ? `Nobody matches "${q}"${status !== "all" ? ` with status ${STATUS_LABEL[status]}` : ""}. Try part of a name${contacts ? " or the last 4 digits of a phone" : ""}.` : "Try a different filter."}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQ("");
                  setStatus("all");
                  setDept("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop and tablet: table */}
            <div className="hidden md:block">
              <Table>
                <caption className="sr-only">Members</caption>
                <THead>
                  <tr>
                    <TH scope="col">Member</TH>
                    <TH scope="col">Phone</TH>
                    <TH scope="col">Departments</TH>
                    <TH scope="col">Status</TH>
                    <TH scope="col" className="hidden lg:table-cell">
                      Last attended
                    </TH>
                    <TH scope="col" className="hidden xl:table-cell">
                      Joined
                    </TH>
                  </tr>
                </THead>
                <tbody>
                  {shown.map((r) => (
                    <MemberTableRow key={r.member.id} row={r} contacts={contacts} onOpen={openMember} />
                  ))}
                </tbody>
              </Table>
            </div>
            {/* Phones: list */}
            <ul className="md:hidden">
              {shown.map((r) => (
                <li key={r.member.id} className="border-t border-line first:border-t-0">
                  <button type="button" onClick={() => openMember(r.member.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cloud">
                    <Avatar initials={initials(r.member.first_name, r.member.last_name)} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-navy">
                        {r.member.first_name} {r.member.last_name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {contacts ? <PhoneText phone={r.member.phone} visible /> : r.departments.map((d) => d.short_name).join(", ") || "No department"}
                      </span>
                    </span>
                    <StatusCell status={r.status} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="flex flex-col gap-3 border-t border-line px-4 py-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {Math.min(limit, rows.length).toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")} · status is derived from attendance (New ≤{" "}
            {church.settings.new_days} days, Inactive after {church.settings.inactive_weeks} weeks)
            {role === "pastor" ? (
              <>
                , editable in{" "}
                <Link href={churchHref(church.slug, "settings")} className="font-semibold text-teal-ink underline underline-offset-4">
                  Settings
                </Link>
              </>
            ) : null}
          </p>
          {rows.length > limit && (
            <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + PAGE * 2)}>
              Show {Math.min(PAGE * 2, rows.length - limit)} more
            </Button>
          )}
        </div>
      </Card>

      {openId && !formFor && <MemberSheet memberId={openId} onClose={() => setParam("id", null)} onEdit={() => setFormFor(openId)} />}
      {formFor && (
        <MemberForm
          key={formFor}
          open
          member={editing}
          onClose={() => setFormFor(null)}
          onSaved={(m) => {
            setFormFor(null);
            openMember(m.id);
          }}
        />
      )}
    </div>
  );
}

function MemberTableRow({ row, contacts, onOpen }: { row: MemberRow; contacts: boolean; onOpen: (id: string) => void }) {
  const m = row.member;
  return (
    <TR className="cursor-pointer hover:bg-cloud" onClick={() => onOpen(m.id)}>
      <TD>
        <div className="flex items-center gap-3">
          <Avatar initials={initials(m.first_name, m.last_name)} size="sm" />
          <button type="button" onClick={() => onOpen(m.id)} className="whitespace-nowrap text-left font-semibold text-navy hover:underline">
            {m.first_name} {m.last_name}
          </button>
        </div>
      </TD>
      <TD className="text-ink">
        <PhoneText phone={m.phone} visible={contacts} />
      </TD>
      <TD>
        <div className="flex flex-wrap gap-1">
          {row.departments.length ? (
            row.departments.slice(0, 2).map((d) => (
              <Badge key={d.id} tone="outline" className="text-[11px]">
                {d.short_name}
              </Badge>
            ))
          ) : (
            <Badge tone="excused" className="text-[11px]">
              Unassigned
            </Badge>
          )}
          {row.departments.length > 2 && <span className="text-xs text-muted">+{row.departments.length - 2}</span>}
        </div>
      </TD>
      <TD>
        <StatusCell status={row.status} />
      </TD>
      <TD className="hidden whitespace-nowrap text-ink lg:table-cell">{lastAttendedText(row.status)}</TD>
      <TD className="hidden whitespace-nowrap text-ink xl:table-cell">{fmtDate(m.joined_on, "MMM yyyy")}</TD>
    </TR>
  );
}
