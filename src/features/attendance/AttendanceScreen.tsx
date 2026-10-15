"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, ScanLine, Search, TrendingDown, TrendingUp } from "lucide-react";
import {
  attendanceTrends,
  createService,
  listServices,
  memberById,
  serviceAttendance,
  sundaySeries,
  useDb,
  type ServiceRow,
} from "@/data/repo";
import type { ServiceKind } from "@/data/types";
import { fmtDate, fmtTime, toISODate } from "@/lib/dates";
import { plural } from "@/lib/cn";
import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal, Sheet } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/Tabs";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";
import { useGuideMark } from "@/components/shell/hooks";
import { AttendanceChart } from "@/features/dashboard/AttendanceChart";
import { KpiCard } from "@/features/dashboard/KpiCard";

type Tab = "services" | "trends";

export function AttendanceScreen() {
  const { church, role, scope, can, support } = useChurch();
  const mark = useGuideMark();
  const [tab, setTab] = useState<Tab>("services");
  const [newOpen, setNewOpen] = useState(false);

  if (!can("attendance")) {
    return <NoAccess body={`${ROLES[role].label}: ${ROLES[role].limits}`} primary={{ href: churchHref(church.slug, ""), label: "Back to dashboard" }} />;
  }
  const canManage = role === "pastor" || role === "secretary";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">{scope.kind === "department" ? `${scope.department.name} members only` : "Services, check-in and trends"}</p>
          <h1 className="mt-1 text-3xl font-extrabold">Attendance</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {!support && (
            <ButtonLink href={churchHref(church.slug, "attendance/check-in")} icon={<ScanLine className="size-4" aria-hidden />}>
              Start check-in
            </ButtonLink>
          )}
          {canManage && (
            <Button variant="secondary" onClick={() => setNewOpen(true)} icon={<CalendarPlus className="size-4" aria-hidden />}>
              New service
            </Button>
          )}
        </div>
      </div>
      <Tabs
        label="Attendance views"
        value={tab}
        onChange={(t) => {
          setTab(t);
          if (t === "trends") mark("view_trends");
        }}
        items={[
          { id: "services", label: "Services" },
          { id: "trends", label: "Trends" },
        ]}
        className="self-start"
      />
      {tab === "services" ? <ServicesTab /> : <TrendsTab />}
      {newOpen && <NewServiceModal churchId={church.id} onClose={() => setNewOpen(false)} />}
    </div>
  );
}

function ServicesTab() {
  const db = useDb();
  const { church, scope } = useChurch();
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(15);
  const rows = listServices(db, church.id, scope);
  const open = rows.filter((r) => !r.service.closed);
  const past = rows.filter((r) => r.service.closed);
  const guests = scope.kind === "church";

  return (
    <>
      <section aria-labelledby="open-services">
        <h2 id="open-services" className="mb-3 text-[17px] font-bold">
          Open for check-in
        </h2>
        {open.length === 0 ? (
          <Card>
            <EmptyState title="No open services" body="Create a service to start checking people in." />
          </Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {open.map((r) => (
              <li key={r.service.id}>
                <Card className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-lg font-bold text-navy">{r.service.name}</p>
                      <p className="text-sm text-muted">
                        {fmtDate(r.service.starts_at, "EEE d MMM")} · {fmtTime(r.service.starts_at)} · {r.service.location}
                      </p>
                    </div>
                    <Badge tone="active">Open</Badge>
                  </div>
                  <p className="text-sm text-ink">
                    <span className="tabular font-semibold">{r.members}</span> checked in
                    {guests && (
                      <>
                        {" "}
                        · <span className="tabular font-semibold">{r.guests}</span> guests
                      </>
                    )}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <ButtonLink href={`${churchHref(church.slug, "attendance/check-in")}?service=${r.service.id}`} size="sm">
                      Open check-in
                    </ButtonLink>
                    <Button variant="secondary" size="sm" onClick={() => setOpenId(r.service.id)}>
                      Who&apos;s here
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card>
        <CardHeader title="Past services" subtitle={guests ? "Members checked in plus counted guests" : `${scope.kind === "department" ? scope.department.name : ""} members only`} />
        <div className="mt-4">
          <Table>
            <caption className="sr-only">Past services</caption>
            <THead>
              <tr>
                <TH scope="col">Date</TH>
                <TH scope="col">Service</TH>
                <TH scope="col" className="text-right">
                  Members
                </TH>
                {guests && (
                  <TH scope="col" className="text-right">
                    Guests
                  </TH>
                )}
                {guests && (
                  <TH scope="col" className="text-right">
                    Total
                  </TH>
                )}
              </tr>
            </THead>
            <tbody>
              {past.slice(0, limit).map((r) => (
                <TR key={r.service.id} className="cursor-pointer hover:bg-cloud" onClick={() => setOpenId(r.service.id)}>
                  <TD className="whitespace-nowrap text-ink">{fmtDate(r.service.starts_at, "EEE d MMM")}</TD>
                  <TD>
                    <button type="button" className="whitespace-nowrap text-left font-semibold text-navy hover:underline" onClick={() => setOpenId(r.service.id)}>
                      {r.service.name}
                    </button>
                  </TD>
                  <TD className="tabular text-right">{r.members}</TD>
                  {guests && <TD className="tabular text-right">{r.guests}</TD>}
                  {guests && <TD className="tabular text-right font-semibold text-navy">{r.total}</TD>}
                </TR>
              ))}
            </tbody>
          </Table>
        </div>
        {past.length > limit && (
          <div className="border-t border-line p-4">
            <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + 20)}>
              Show older services
            </Button>
          </div>
        )}
      </Card>
      {openId && <ServiceSheet row={rows.find((r) => r.service.id === openId)} onClose={() => setOpenId(null)} />}
    </>
  );
}

function ServiceSheet({ row, onClose }: { row: ServiceRow | undefined; onClose: () => void }) {
  const db = useDb();
  const { church, scope } = useChurch();
  const [q, setQ] = useState("");
  const attendees = useMemo(() => {
    if (!row) return [];
    const scoped = scope.kind === "department" ? new Set(db.member_departments.filter((md) => md.department_id === scope.department.id).map((md) => md.member_id)) : null;
    return [...serviceAttendance(db, row.service.id).values()]
      .filter((a) => !scoped || scoped.has(a.member_id))
      .map((a) => ({ a, m: memberById(db, a.member_id)! }))
      .filter((x) => x.m && `${x.m.first_name} ${x.m.last_name}`.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((x, y) => x.a.checked_in_at.localeCompare(y.a.checked_in_at));
  }, [db, row, scope, q]);
  if (!row) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={row.service.name}
      description={`${fmtDate(row.service.starts_at, "EEEE d MMMM yyyy")} · ${fmtTime(row.service.starts_at)} · ${row.service.location}`}
      footer={
        !row.service.closed ? (
          <ButtonLink href={`${churchHref(church.slug, "attendance/check-in")}?service=${row.service.id}`}>Open check-in</ButtonLink>
        ) : undefined
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Members", row.members],
          ["Guests", scope.kind === "church" ? row.guests : "Hidden"],
          ["Total", scope.kind === "church" ? row.total : row.members],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-cloud p-3">
            <p className="text-xs text-muted">{k}</p>
            <p className="tabular font-heading text-xl font-bold text-navy">{v}</p>
          </div>
        ))}
      </div>
      <div className="relative mt-4">
        <label htmlFor="attendee-search" className="sr-only">
          Search attendees
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input id="attendee-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search attendees" className="pl-9" />
      </div>
      <ul className="mt-3 divide-y divide-line">
        {attendees.map(({ a, m }) => (
          <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="font-medium text-ink">
              {m.first_name} {m.last_name}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted">
              {a.sync_state === "pending" && <Badge tone="new">Waiting to sync</Badge>}
              {a.sync_state === "error" && <Badge tone="inactive">Sync failed</Badge>}
              {fmtTime(a.checked_in_at)} · {a.device}
            </span>
          </li>
        ))}
        {attendees.length === 0 && <li className="py-6 text-center text-sm text-muted">{q ? "No one by that name." : "No one checked in yet."}</li>}
      </ul>
    </Sheet>
  );
}

const KIND_NAMES: Record<ServiceKind, string> = { sunday: "Sunday Worship", midweek: "Midweek Bible Study", special: "Special service" };

function NewServiceModal({ churchId, onClose }: { churchId: string; onClose: () => void }) {
  const [kind, setKind] = useState<ServiceKind>("special");
  const [name, setName] = useState(KIND_NAMES.special);
  const [date, setDate] = useState(toISODate(new Date()));
  const [time, setTime] = useState("18:00");
  const [location, setLocation] = useState("Main sanctuary");
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (name.trim().length < 3) {
      setError("Give the service a name.");
      return;
    }
    const s = createService({ church_id: churchId, kind, name: name.trim(), starts_at: new Date(`${date}T${time}`).toISOString(), location: location.trim() || "Main sanctuary" });
    toast("Service created", { body: `${s.name} is open for check-in.` });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="New service"
      description="Opens the service for check-in on every usher's device."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Create service</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Type">
          {(p) => (
            <Select
              {...p}
              value={kind}
              onChange={(e) => {
                const k = e.target.value as ServiceKind;
                setKind(k);
                setName(KIND_NAMES[k]);
              }}
            >
              <option value="sunday">Sunday service</option>
              <option value="midweek">Midweek service</option>
              <option value="special">Special service or event</option>
            </Select>
          )}
        </Field>
        <Field label="Name" error={error}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Time">{(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
        </div>
        <Field label="Location">{(p) => <Input {...p} value={location} onChange={(e) => setLocation(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}

function TrendsTab() {
  const db = useDb();
  const { church, scope } = useChurch();
  const t = attendanceTrends(db, church.id, scope);
  const up = (t.changePct ?? 0) >= 0;
  const isDept = scope.kind === "department";
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Avg. Sunday, last 6 weeks" value={t.avg6} note={isDept ? "Department members" : "Members and guests"} />
        <KpiCard
          label="Change vs previous 6 weeks"
          value={
            <span className="inline-flex items-center gap-1.5">
              {up ? <TrendingUp className="size-6 text-teal" aria-hidden /> : <TrendingDown className="size-6 text-danger" aria-hidden />}
              {t.changePct === null ? "n/a" : `${up ? "+" : ""}${t.changePct}%`}
            </span>
          }
          note={`From an average of ${t.prev6}`}
          noteTone={up ? "teal" : "muted"}
        />
        <KpiCard label="Avg. guests per Sunday" value={isDept ? "Hidden" : t.guestsAvg6} note={isDept ? "Guests aren't counted by department" : "Counted, not named"} />
        <KpiCard label="Avg. midweek service" value={t.midweekAvg6} note="Last 6 weeks" />
      </div>
      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="flex min-w-0 flex-col lg:col-span-3">
          <CardHeader title={isDept ? `${scope.department.name} Sunday attendance` : "Sunday attendance"} action={<span className="text-xs text-muted">Last 12 Sundays</span>} />
          <div className="flex flex-1 flex-col justify-end px-5 pb-5">
            <AttendanceChart points={sundaySeries(db, church.id, 12, scope)} includesGuests={!isDept} />
          </div>
        </Card>
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="By department" subtitle={t.lastSunday ? `Present on ${fmtDate(t.lastSunday.starts_at, "d MMM")}` : undefined} />
          <ul className="flex flex-col gap-3 px-5 pb-5 pt-4">
            {t.departments.map((d) => {
              const pct = d.members ? Math.round((d.present / d.members) * 100) : 0;
              return (
                <li key={d.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{d.name}</span>
                    <span className="tabular text-muted">
                      {d.present} of {plural(d.members, "member")} · <span className="font-semibold text-navy">{pct}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-teal" style={{ width: `${Math.max(2, pct)}%` }} aria-hidden />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
