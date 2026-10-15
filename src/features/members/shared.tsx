"use client";

import { EyeOff } from "lucide-react";
import type { MemberStatus, StatusResult } from "@/lib/status";
import { STATUS_LABEL } from "@/lib/status";
import { formatPhone } from "@/lib/phone";
import { fmtDate } from "@/lib/dates";
import { Badge } from "@/components/ui/Badge";

/** Status badge plus the short reason underneath (e.g. "7 weeks absent"). */
export function StatusCell({ status }: { status: StatusResult }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge tone={status.status}>{STATUS_LABEL[status.status]}</Badge>
      {status.detail && <span className="text-[11px] leading-tight text-muted">{status.detail}</span>}
    </div>
  );
}

/** Phone number, or a clear "hidden" note for roles without contact access. */
export function PhoneText({ phone, visible }: { phone: string | null; visible: boolean }) {
  if (!visible)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <EyeOff className="size-3.5" aria-hidden /> Hidden for your role
      </span>
    );
  if (!phone) return <span className="text-xs text-muted">No phone</span>;
  return <span className="tabular whitespace-nowrap">{formatPhone(phone)}</span>;
}

export function lastAttendedText(status: StatusResult): string {
  return status.last_attended ? fmtDate(status.last_attended) : "Not yet";
}

export const STATUS_FILTERS: (MemberStatus | "all")[] = ["all", "active", "new", "inactive", "excused"];
