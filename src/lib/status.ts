import { differenceInCalendarDays, parseISO } from "date-fns";
import type { ChurchSettings, Member } from "@/data/types";

/**
 * Derived membership status (spec section 8). Never stored.
 * - Excused: approved exception; never shown as inactive.
 * - New: joined within `new_days`.
 * - Active: attended within `inactive_weeks`.
 * - Inactive: no attendance for `inactive_weeks` or more.
 * Guard: if the church recorded no services in the window, nobody is
 * marked inactive (a data gap must not label the whole church inactive).
 */
export type MemberStatus = "new" | "active" | "inactive" | "excused";

export const STATUS_LABEL: Record<MemberStatus, string> = {
  new: "New",
  active: "Active",
  inactive: "Inactive",
  excused: "Excused",
};

export interface StatusResult {
  status: MemberStatus;
  /** Short explanation shown under the badge. */
  detail: string;
  last_attended: string | null;
}

export function deriveStatus(
  member: Member,
  lastAttended: string | null,
  settings: ChurchSettings,
  now: Date,
  hadServicesInWindow: boolean,
): StatusResult {
  if (member.exception) {
    const kind =
      member.exception.kind === "homebound"
        ? "Homebound"
        : member.exception.kind === "leave"
          ? "Approved leave"
          : "Pastoral exception";
    return { status: "excused", detail: `${kind} · not marked inactive`, last_attended: lastAttended };
  }
  const joinedDays = differenceInCalendarDays(now, parseISO(member.joined_on));
  if (joinedDays <= settings.new_days) {
    return { status: "new", detail: `Joined ${joinedDays === 0 ? "today" : `${joinedDays}d ago`}`, last_attended: lastAttended };
  }
  const windowDays = settings.inactive_weeks * 7;
  // Imported members have no attendance history in ShepherdOS yet. Until they
  // have been in the system for a full window, they are not called inactive.
  if (member.imported_at && (!lastAttended || lastAttended < member.imported_at.slice(0, 10))) {
    const sinceImport = differenceInCalendarDays(now, parseISO(member.imported_at));
    if (sinceImport < windowDays) {
      return { status: "new", detail: "Imported · awaiting first check-in", last_attended: lastAttended };
    }
  }
  if (lastAttended) {
    const since = differenceInCalendarDays(now, parseISO(lastAttended));
    if (since < windowDays) return { status: "active", detail: "", last_attended: lastAttended };
    if (!hadServicesInWindow) return { status: "active", detail: "No services recorded recently", last_attended: lastAttended };
    const weeks = Math.floor(since / 7);
    return { status: "inactive", detail: `${weeks} weeks absent`, last_attended: lastAttended };
  }
  if (!hadServicesInWindow) return { status: "active", detail: "No services recorded recently", last_attended: null };
  return { status: "inactive", detail: "No attendance recorded", last_attended: null };
}
