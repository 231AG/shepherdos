"use client";

/** Church events: calendar, create, link to a service. Re-exported by repo.ts. */
import { addMinutes, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { randomUuid } from "@/mock/prng";
import { addRow, currentDb, patchRow, type Db } from "./core";
import { createService } from "./attendance";
import type { ChurchEvent, Service } from "./types";

/** All events a viewer may see. Department heads see church-wide events and their own department's. */
export function listEvents(db: Db, churchId: string, departmentId?: string): ChurchEvent[] {
  return db.events
    .filter((e) => e.church_id === churchId)
    .filter((e) => !departmentId || e.department_id === null || e.department_id === departmentId)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function eventsInMonth(events: ChurchEvent[], month: Date): ChurchEvent[] {
  const from = startOfMonth(month).toISOString();
  const to = endOfMonth(month).toISOString();
  return events.filter((e) => e.starts_at >= from && e.starts_at <= to);
}

/** Events grouped by local calendar day (yyyy-MM-dd). */
export function eventsByDay(events: ChurchEvent[]): Map<string, ChurchEvent[]> {
  const out = new Map<string, ChurchEvent[]>();
  for (const e of events) {
    const key = format(parseISO(e.starts_at), "yyyy-MM-dd");
    const list = out.get(key);
    if (list) list.push(e);
    else out.set(key, [e]);
  }
  return out;
}

/** Services an event can be linked to: any service on the same day. */
export function servicesOnDay(db: Db, churchId: string, startsAt: string): Service[] {
  const day = format(parseISO(startsAt), "yyyy-MM-dd");
  return db.services
    .filter((s) => s.church_id === churchId && format(parseISO(s.starts_at), "yyyy-MM-dd") === day)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export interface EventInput {
  churchId: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  location: string;
  description: string;
  departmentId: string | null;
  serviceId: string | null;
}

export function createEvent(input: EventInput): ChurchEvent {
  const event: ChurchEvent = {
    id: randomUuid(),
    church_id: input.churchId,
    title: input.title.trim(),
    starts_at: input.startsAt.toISOString(),
    ends_at: addMinutes(input.startsAt, input.durationMinutes).toISOString(),
    location: input.location.trim(),
    description: input.description.trim(),
    department_id: input.departmentId,
    service_id: input.serviceId,
    reminder_planned: false,
    created_at: new Date().toISOString(),
  };
  addRow("events", event);
  return event;
}

export function linkEventToService(eventId: string, serviceId: string | null) {
  patchRow("events", eventId, { service_id: serviceId });
}

/**
 * Create a special service at the event's time and link it, so attendance for
 * the event can be taken on the Check-in screen.
 */
export function createServiceForEvent(event: ChurchEvent): Service {
  const service = createService({
    church_id: event.church_id,
    kind: "special",
    name: event.title,
    starts_at: event.starts_at,
    location: event.location,
  });
  linkEventToService(event.id, service.id);
  return service;
}

export function markReminderPlanned(eventId: string) {
  const e = currentDb().events.find((x) => x.id === eventId);
  if (e && !e.reminder_planned) patchRow("events", eventId, { reminder_planned: true });
}

/** Default SMS text for an event reminder. Kept within one GSM-7 segment where possible. */
export function reminderText(event: ChurchEvent, churchShortName: string): string {
  const when = format(parseISO(event.starts_at), "EEE d MMM, h:mm a");
  return `${churchShortName}: reminder, ${event.title} on ${when} at ${event.location}. All are welcome.`;
}
