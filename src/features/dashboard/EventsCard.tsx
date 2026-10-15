"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { upcomingEvents, useDb } from "@/data/repo";
import { fmtDate } from "@/lib/dates";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/misc";
import { useChurch } from "@/components/shell/ChurchContext";
import { churchHref } from "@/components/shell/nav";

export function EventsCard() {
  const db = useDb();
  const { church, scope } = useChurch();
  const events = upcomingEvents(db, church.id, { limit: 3, departmentId: scope.kind === "department" ? scope.department.id : undefined });
  return (
    <Card>
      <CardHeader
        title="Upcoming"
        action={
          <Link href={churchHref(church.slug, "events")} className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-ink underline underline-offset-4 md:min-h-0">
            All events
          </Link>
        }
      />
      {events.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-5" />} title="Nothing scheduled" body="Upcoming events will show here." />
      ) : (
        <ul className="flex flex-col gap-3 px-5 pb-5 pt-4">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-3">
              <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-line py-1.5" aria-hidden>
                <span className="text-[10px] font-bold uppercase tracking-wider text-danger-ink">{fmtDate(e.starts_at, "MMM")}</span>
                <span className="font-heading text-lg font-extrabold leading-tight text-navy">{fmtDate(e.starts_at, "d")}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy">{e.title}</p>
                <p className="truncate text-xs text-muted">
                  <span className="sr-only">{fmtDate(e.starts_at, "d MMMM")}, </span>
                  {fmtDate(e.starts_at, "EEE")} · {fmtDate(e.starts_at, "h:mm a")} · {e.reminder_planned ? "Reminder SMS planned" : e.location}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
