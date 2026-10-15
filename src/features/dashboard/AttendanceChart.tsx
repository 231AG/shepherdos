"use client";

import type { AttendancePoint } from "@/data/repo";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { fmtDate } from "@/lib/dates";

export function AttendanceChart({ points, includesGuests }: { points: AttendancePoint[]; includesGuests: boolean }) {
  return (
    <ColumnChart
      height="h-56 sm:h-64 lg:h-80"
      caption={`Sunday attendance, last ${points.length} Sundays`}
      columns={points.map((p) => ({
        key: p.service.id,
        label: fmtDate(p.service.starts_at, "MMM d"),
        value: p.total,
        ariaLabel: `${fmtDate(p.service.starts_at, "d MMMM")}: ${p.total} present${includesGuests ? `, ${p.members} members and ${p.guests} guests` : ""}`,
        tooltip: [
          fmtDate(p.service.starts_at, "EEE d MMM"),
          `${p.total} present`,
          ...(includesGuests ? [`${p.members} members · ${p.guests} guests`] : []),
        ],
      }))}
    />
  );
}
