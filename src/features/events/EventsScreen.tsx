"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock, Link2, MapPin, MessageSquareText, Plus, ScanLine, Unlink, Users } from "lucide-react";
import {
  createEvent,
  createServiceForEvent,
  eventsByDay,
  eventsInMonth,
  getService,
  linkEventToService,
  listDepartments,
  listEvents,
  markReminderPlanned,
  reminderText,
  servicesOnDay,
  useDb,
} from "@/data/repo";
import type { ChurchEvent } from "@/data/types";
import { fmtDate, fmtTime, toISODate } from "@/lib/dates";
import { cn, plural } from "@/lib/cn";
import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal, Sheet } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Chips, Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";

type View = "calendar" | "list";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function EventsScreen() {
  const db = useDb();
  const { church, role, scope, can } = useChurch();
  const params = useSearchParams();
  const router = useRouter();
  const deptId = scope.kind === "department" ? scope.department.id : undefined;
  const events = listEvents(db, church.id, deptId);
  const opened = params.get("event");
  const openEvent = opened ? events.find((e) => e.id === opened) : undefined;

  const [view, setView] = useState<View>(params.get("view") === "list" ? "list" : "calendar");
  const [month, setMonth] = useState(() => startOfMonth(openEvent ? parseISO(openEvent.starts_at) : db.now));
  const [selected, setSelected] = useState<Date>(() => (openEvent ? parseISO(openEvent.starts_at) : db.now));
  const [detailId, setDetailId] = useState<string | null>(openEvent?.id ?? null);
  const [createOn, setCreateOn] = useState<Date | null>(null);

  if (!can("events")) {
    return (
      <NoAccess
        body={`${ROLES[role].label}: ${ROLES[role].limits}`}
        primary={{
          href: churchHref(church.slug, ""),
          label: "Back to dashboard",
        }}
      />
    );
  }
  const canCreate = role === "pastor" || role === "secretary" || role === "dept_head";
  const nowIso = db.now.toISOString();
  const upcoming = events.filter((e) => e.starts_at >= nowIso);
  const detail = detailId ? events.find((e) => e.id === detailId) : undefined;
  const openDetail = (id: string) => {
    setDetailId(id);
    router.replace(`${churchHref(church.slug, "events")}?event=${id}`, {
      scroll: false,
    });
  };
  const closeDetail = () => {
    setDetailId(null);
    router.replace(churchHref(church.slug, "events"), { scroll: false });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {scope.kind === "department" ? `Church-wide and ${scope.department.name} events` : church.short_name} · {plural(upcoming.length, "upcoming event")}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold">Events</h1>
        </div>
        {canCreate ? (
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreateOn(selected < db.now ? db.now : selected)}>
            New event
          </Button>
        ) : (
          <p className="text-sm text-muted">View only for the {ROLES[role].short.toLowerCase()}.</p>
        )}
      </div>

      <Tabs
        label="View"
        items={[
          { id: "calendar", label: "Calendar" },
          { id: "list", label: "List" },
        ]}
        value={view}
        onChange={setView}
        className="self-start"
      />

      {view === "calendar" ? (
        <CalendarView
          events={events}
          month={month}
          setMonth={setMonth}
          selected={selected}
          setSelected={setSelected}
          onOpen={openDetail}
          onCreate={canCreate ? (d) => setCreateOn(d) : undefined}
        />
      ) : (
        <ListView events={events} onOpen={openDetail} />
      )}

      {detail && <EventSheet event={detail} onClose={closeDetail} />}
      {createOn && (
        <CreateEventModal
          date={createOn}
          onClose={() => setCreateOn(null)}
          onCreated={(e) => {
            setCreateOn(null);
            const d = parseISO(e.starts_at);
            setMonth(startOfMonth(d));
            setSelected(d);
            openDetail(e.id);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

function CalendarView({
  events,
  month,
  setMonth,
  selected,
  setSelected,
  onOpen,
  onCreate,
}: {
  events: ChurchEvent[];
  month: Date;
  setMonth: (d: Date) => void;
  selected: Date;
  setSelected: (d: Date) => void;
  onOpen: (id: string) => void;
  onCreate?: (d: Date) => void;
}) {
  const db = useDb();
  const byDay = eventsByDay(eventsInMonth(events, month));
  const start = startOfWeek(startOfMonth(month));
  const end = endOfWeek(endOfMonth(month));
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const dayEvents = eventsByDay(events).get(toISODate(selected)) ?? [];
  const selectedDay = toISODate(selected);
  const nextUp = events.filter((e) => toISODate(parseISO(e.starts_at)) > selectedDay && e.starts_at >= db.now.toISOString()).slice(0, 3);
  const monthCount = eventsInMonth(events, month).length;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-5">
          <div className="flex items-center gap-1">
            <IconButton aria-label="Previous month" onClick={() => setMonth(subMonths(month, 1))}>
              <ChevronLeft className="size-5" />
            </IconButton>
            <h2 className="min-w-36 text-center text-lg font-bold" aria-live="polite">
              {format(month, "MMMM yyyy")}
            </h2>
            <IconButton aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight className="size-5" />
            </IconButton>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{plural(monthCount, "event")}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setMonth(startOfMonth(db.now));
                setSelected(db.now);
              }}
            >
              Today
            </Button>
          </div>
        </div>
        <div role="grid" aria-label={format(month, "MMMM yyyy")} className="border-t border-line">
          <div role="row" className="grid grid-cols-7 bg-cloud">
            {WEEKDAYS.map((d) => (
              <div key={d} role="columnheader" className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
                <span className="sm:hidden" aria-hidden>
                  {d[0]}
                </span>
                <span className="max-sm:sr-only">{d}</span>
              </div>
            ))}
          </div>
          {Array.from({ length: days.length / 7 }, (_, w) => (
            <div role="row" key={w} className="grid grid-cols-7">
              {days.slice(w * 7, w * 7 + 7).map((d) => {
                const key = toISODate(d);
                const list = byDay.get(key) ?? [];
                const inMonth = isSameMonth(d, month);
                const isToday = isSameDay(d, db.now);
                const isSelected = isSameDay(d, selected);
                return (
                  <div
                    role="gridcell"
                    key={key}
                    aria-selected={isSelected}
                    className={cn(
                      "min-h-16 border-t border-line p-1 sm:min-h-24 sm:p-1.5 [&:not(:first-child)]:border-l",
                      !inMonth && "bg-cloud/70",
                      isSelected && "bg-gold-soft",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(d)}
                      aria-label={`${format(d, "EEEE d MMMM")}${list.length ? `, ${plural(list.length, "event")}` : ", no events"}`}
                      className="flex w-full flex-col items-center gap-1 rounded-lg py-1 hover:bg-navy-50 sm:items-start sm:px-1"
                    >
                      <span
                        className={cn(
                          "tabular inline-flex size-7 items-center justify-center rounded-full text-sm",
                          isToday ? "bg-navy font-bold text-white" : inMonth ? "font-semibold text-navy" : "text-muted",
                        )}
                      >
                        {format(d, "d")}
                      </span>
                      {list.length > 0 && (
                        <span className="flex gap-0.5 sm:hidden" aria-hidden>
                          {list.slice(0, 3).map((e) => (
                            <span key={e.id} className={cn("size-1.5 rounded-full", e.department_id ? "bg-gold" : "bg-teal")} />
                          ))}
                        </span>
                      )}
                    </button>
                    <ul className="mt-0.5 hidden flex-col gap-0.5 sm:flex">
                      {list.slice(0, 2).map((e) => (
                        <li key={e.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(d);
                              onOpen(e.id);
                            }}
                            title={`${fmtTime(e.starts_at)} · ${e.title}`}
                            className={cn(
                              "line-clamp-2 block w-full rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold leading-snug",
                              e.department_id ? "bg-gold-soft text-gold-ink hover:bg-gold/40" : "bg-teal-soft text-teal-ink hover:bg-teal/20",
                            )}
                          >
                            {e.title}
                          </button>
                        </li>
                      ))}
                      {list.length > 2 && (
                        <li>
                          <button type="button" onClick={() => setSelected(d)} className="px-1.5 text-xs font-semibold text-navy-600 hover:underline">
                            +{list.length - 2} more
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 border-t border-line px-5 py-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-teal" aria-hidden /> Whole church
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-gold" aria-hidden /> Department
          </span>
        </div>
      </Card>

      <Card className="self-start">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-[17px] font-bold">{format(selected, "EEEE")}</h2>
            <p className="text-sm text-muted">{format(selected, "d MMMM yyyy")}</p>
          </div>
          {onCreate && toISODate(selected) >= toISODate(db.now) && (
            <Button variant="secondary" size="sm" icon={<CalendarPlus className="size-4" aria-hidden />} onClick={() => onCreate(selected)}>
              Add
            </Button>
          )}
        </div>
        {dayEvents.length === 0 ? (
          <>
            <p className="px-5 pt-3 text-sm text-muted">Nothing on this day.</p>
            {nextUp.length > 0 ? (
              <>
                <h3 className="px-5 pt-4 text-xs font-semibold uppercase tracking-wide text-muted">Coming up next</h3>
                <ul className="flex flex-col gap-2 px-3 pb-4 pt-2">
                  {nextUp.map((e) => (
                    <li key={e.id}>
                      <EventRow
                        event={e}
                        onOpen={(id) => {
                          setSelected(parseISO(e.starts_at));
                          setMonth(startOfMonth(parseISO(e.starts_at)));
                          onOpen(id);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState
                icon={<CalendarDays className="size-5" />}
                title="Nothing coming up"
                body="Events you create appear here and on the calendar."
                className="py-8"
              />
            )}
          </>
        ) : (
          <ul className="flex flex-col gap-2 px-3 pb-4 pt-3">
            {dayEvents.map((e) => (
              <li key={e.id}>
                <EventRow event={e} onOpen={onOpen} compact />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

function ListView({ events, onOpen }: { events: ChurchEvent[]; onOpen: (id: string) => void }) {
  const db = useDb();
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const nowIso = db.now.toISOString();
  const upcoming = events.filter((e) => e.starts_at >= nowIso);
  const past = events.filter((e) => e.starts_at < nowIso).reverse();
  const list = when === "upcoming" ? upcoming : past;
  const groups = new Map<string, ChurchEvent[]>();
  for (const e of list) {
    const k = format(parseISO(e.starts_at), "MMMM yyyy");
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return (
    <div className="flex flex-col gap-4">
      <Chips
        label="Which events"
        items={[
          { id: "upcoming", label: "Upcoming", count: upcoming.length },
          { id: "past", label: "Past", count: past.length },
        ]}
        value={when}
        onChange={setWhen}
      />
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title={when === "upcoming" ? "Nothing scheduled" : "No past events"}
            body="Events you create appear here and on the calendar."
          />
        </Card>
      ) : (
        [...groups].map(([label, items]) => (
          <Card key={label}>
            <h2 className="px-5 pt-4 text-sm font-semibold uppercase tracking-wide text-muted">{label}</h2>
            <ul className="flex flex-col gap-1 px-3 pb-3 pt-2">
              {items.map((e) => (
                <li key={e.id}>
                  <EventRow event={e} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

function EventRow({ event, onOpen, compact = false }: { event: ChurchEvent; onOpen: (id: string) => void; compact?: boolean }) {
  const db = useDb();
  const dept = event.department_id ? db.departments.find((d) => d.id === event.department_id) : undefined;
  return (
    <button type="button" onClick={() => onOpen(event.id)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-navy-50">
      <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-line bg-white py-1.5" aria-hidden>
        <span className="text-[10px] font-bold uppercase tracking-wider text-danger-ink">{fmtDate(event.starts_at, compact ? "EEE" : "MMM")}</span>
        <span className="font-heading text-lg font-extrabold leading-tight text-navy">{fmtDate(event.starts_at, "d")}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-navy">{event.title}</p>
        <p className="truncate text-sm text-muted">
          {fmtTime(event.starts_at)} · {event.location}
        </p>
        {!compact && (dept || event.service_id || event.reminder_planned) && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {dept && <Badge tone="new">{dept.name}</Badge>}
            {event.service_id && <Badge tone="active">Linked to a service</Badge>}
            {event.reminder_planned && <Badge tone="neutral">Reminder SMS</Badge>}
          </div>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

function EventSheet({ event, onClose }: { event: ChurchEvent; onClose: () => void }) {
  const db = useDb();
  const router = useRouter();
  const { church, role, scope, can } = useChurch();
  const dept = event.department_id ? db.departments.find((d) => d.id === event.department_id) : undefined;
  const service = getService(db, event.service_id);
  const sameDay = servicesOnDay(db, church.id, event.starts_at).filter((s) => s.id !== event.service_id);
  const [pick, setPick] = useState(sameDay[0]?.id ?? "");
  const past = event.starts_at < db.now.toISOString();
  const canManage =
    role === "pastor" || role === "secretary" || (role === "dept_head" && scope.kind === "department" && event.department_id === scope.department.id);

  const sendReminder = () => {
    markReminderPlanned(event.id);
    const q = new URLSearchParams({
      body: reminderText(event, church.short_name),
      event: event.id,
    });
    if (event.department_id) q.set("dept", event.department_id);
    router.push(`${churchHref(church.slug, "messaging")}?${q.toString()}`);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={event.title}
      description={dept ? `${dept.name} event` : "Whole church"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {!past &&
            (can("messaging") ? (
              <Button variant="teal" icon={<MessageSquareText className="size-4" aria-hidden />} onClick={sendReminder}>
                Send reminder
              </Button>
            ) : null)}
        </>
      }
    >
      <dl className="flex flex-col gap-3 text-[15px]">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
          <div>
            <dt className="sr-only">When</dt>
            <dd className="font-semibold text-navy">{fmtDate(event.starts_at, "EEEE d MMMM yyyy")}</dd>
            <dd className="text-sm text-muted">
              {fmtTime(event.starts_at)}
              {event.ends_at && ` to ${fmtTime(event.ends_at)}`}
              {past && " · This event has passed"}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
          <div>
            <dt className="sr-only">Where</dt>
            <dd className="text-ink">{event.location}</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
          <div>
            <dt className="sr-only">Who</dt>
            <dd className="text-ink">{dept ? `${dept.name} members, and anyone invited` : "The whole church"}</dd>
          </div>
        </div>
      </dl>
      {event.description && <p className="mt-4 rounded-xl bg-cloud p-4 text-[15px] leading-relaxed text-ink">{event.description}</p>}

      <section className="mt-6" aria-labelledby="ev-service">
        <h3 id="ev-service" className="text-base font-bold">
          Service for check-in
        </h3>
        {service ? (
          <div className="mt-2 flex flex-col gap-3 rounded-xl border border-line p-4">
            <div className="flex items-start gap-3">
              <Link2 className="mt-0.5 size-5 shrink-0 text-teal" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold text-navy">{service.name}</p>
                <p className="text-sm text-muted">
                  {fmtDate(service.starts_at, "EEE d MMM")} · {fmtTime(service.starts_at)} · {service.closed ? "Closed" : "Open for check-in"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {can("attendance") && (
                <ButtonLink
                  href={`${churchHref(church.slug, "attendance/check-in")}?service=${service.id}`}
                  variant="secondary"
                  size="sm"
                  icon={<ScanLine className="size-4" aria-hidden />}
                >
                  {service.closed ? "View attendance" : "Open check-in"}
                </ButtonLink>
              )}
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Unlink className="size-4" aria-hidden />}
                  onClick={() => {
                    linkEventToService(event.id, null);
                    toast("Service unlinked", {
                      body: "The service and its attendance are unchanged.",
                    });
                  }}
                >
                  Unlink
                </Button>
              )}
            </div>
          </div>
        ) : canManage ? (
          <div className="mt-2 flex flex-col gap-3 rounded-xl border border-dashed border-line-strong p-4">
            <p className="text-sm text-muted">Link this event to a service so attendance can be taken on the Check-in screen.</p>
            {sameDay.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select aria-label="Service on this day" value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1">
                  {sameDay.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {fmtTime(s.starts_at)}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  onClick={() => {
                    linkEventToService(event.id, pick);
                    toast("Linked to service", {
                      body: "Check-ins for that service now count for this event.",
                    });
                  }}
                >
                  Link
                </Button>
              </div>
            )}
            <Button
              variant={sameDay.length ? "ghost" : "secondary"}
              className="self-start"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => {
                const s = createServiceForEvent(event);
                toast("Service created and linked", {
                  body: `${s.name} is open for check-in.`,
                });
              }}
            >
              Create a service at this time
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Not linked to a service.</p>
        )}
      </section>

      {!past && (
        <section className="mt-6" aria-labelledby="ev-reminder">
          <h3 id="ev-reminder" className="text-base font-bold">
            Reminder
          </h3>
          <p className="mt-1 text-sm text-muted">
            {can("messaging")
              ? event.reminder_planned
                ? "A reminder SMS is planned. Send reminder opens Messaging with the text ready to review."
                : `Send reminder opens Messaging with the text ready${dept ? ` and ${dept.name} selected` : ""}.`
              : "The secretary or pastor sends SMS reminders from Messaging."}
          </p>
          {can("messaging") && <p className="mt-2 rounded-xl bg-cloud p-3 text-sm text-ink">{reminderText(event, church.short_name)}</p>}
        </section>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

const DURATIONS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
  { minutes: 240, label: "Half day (4 hours)" },
  { minutes: 480, label: "Full day (8 hours)" },
];

function CreateEventModal({ date, onClose, onCreated }: { date: Date; onClose: () => void; onCreated: (e: ChurchEvent) => void }) {
  const db = useDb();
  const { church, scope } = useChurch();
  const departments = listDepartments(db, church.id);
  const ownDept = scope.kind === "department" ? scope.department : null;
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(toISODate(date));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(120);
  const [location, setLocation] = useState(church.slug === "living-waters" ? "Main hall" : "Main sanctuary");
  const [deptId, setDeptId] = useState(ownDept?.id ?? "");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState<string>("none");
  const [tried, setTried] = useState(false);

  const startsAt = day && time ? new Date(`${day}T${time}:00`) : null;
  const sameDay = startsAt ? servicesOnDay(db, church.id, startsAt.toISOString()) : [];
  const titleError = !title.trim() ? "Give the event a name." : null;
  const dateError = !startsAt ? "Choose a date and time." : startsAt < new Date() ? "Choose a time in the future." : null;
  const locationError = !location.trim() ? "Say where it happens." : null;

  const submit = () => {
    setTried(true);
    if (titleError || dateError || locationError || !startsAt) return;
    const existing = link !== "none" && link !== "new" ? link : null;
    const event = createEvent({
      churchId: church.id,
      title,
      startsAt,
      durationMinutes: duration,
      location,
      description,
      departmentId: deptId || null,
      serviceId: existing,
    });
    if (link === "new") createServiceForEvent(event);
    toast("Event created", {
      body: `${event.title} is on the calendar for ${fmtDate(event.starts_at, "EEE d MMM")}.`,
    });
    onCreated(event);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New event"
      description="Shown on the calendar for everyone it concerns."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-event-form">
            Create event
          </Button>
        </>
      }
    >
      <form
        id="new-event-form"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Event name" error={tried ? titleError : null}>
          {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Choir rehearsal" autoFocus />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" error={tried ? dateError : null}>
            {(p) => <Input {...p} type="date" value={day} min={toISODate(db.now)} onChange={(e) => setDay(e.target.value)} />}
          </Field>
          <Field label="Starts">{(p) => <Input {...p} type="time" value={time} step={900} onChange={(e) => setTime(e.target.value)} />}</Field>
        </div>
        <Field label="How long">
          {(p) => (
            <Select {...p} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d.minutes} value={d.minutes}>
                  {d.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Location" error={tried ? locationError : null}>
          {(p) => <Input {...p} value={location} onChange={(e) => setLocation(e.target.value)} />}
        </Field>
        <Field label="Who it's for" hint={ownDept ? "Department heads create events for their own department." : undefined}>
          {(p) => (
            <Select {...p} value={deptId} onChange={(e) => setDeptId(e.target.value)} disabled={!!ownDept}>
              {!ownDept && <option value="">Whole church</option>}
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Service for check-in" hint="Linking a service lets ushers take attendance for this event.">
          {(p) => (
            <Select {...p} value={link} onChange={(e) => setLink(e.target.value)}>
              <option value="none">No service</option>
              {sameDay.map((s) => (
                <option key={s.id} value={s.id}>
                  Link to {s.name} · {fmtTime(s.starts_at)}
                </option>
              ))}
              <option value="new">Create a new service at this time</option>
            </Select>
          )}
        </Field>
        <Field label="Details (optional)">
          {(p) => (
            <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What to bring, who to contact, and so on" />
          )}
        </Field>
      </form>
    </Modal>
  );
}
