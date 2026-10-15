"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertCircle, Check, ChevronLeft, CloudOff, Loader2, Lock, Minus, MoreVertical, Plus, Search } from "lucide-react";
import {
  checkIn,
  defaultCheckInService,
  getService,
  listMembers,
  memberDepartmentsIndex,
  retrySync,
  serviceAttendance,
  setGuestCount,
  syncNow,
  undoCheckIn,
  useDb,
} from "@/data/repo";
import type { AttendanceRecord, Member } from "@/data/types";
import { useDemoStore } from "@/data/store";
import { canAccess } from "@/lib/access";
import { cn, initials, plural } from "@/lib/cn";
import { fmtDate, fmtTime } from "@/lib/dates";
import { formatPhoneShort, phoneMatches } from "@/lib/phone";
import { ROLES } from "@/lib/roles";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { Chips } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";
import { useGuideMark } from "@/components/shell/hooks";

type Filter = "all" | "out" | "in";
type RowState = "none" | "synced" | "pending" | "syncing" | "error";
const LIMIT = 60;

function rowState(rec: AttendanceRecord | undefined, syncing: Set<string>): RowState {
  if (!rec) return "none";
  if (syncing.has(rec.id)) return "syncing";
  return rec.sync_state;
}

export function CheckInScreen() {
  const db = useDb();
  const { church, role, scope } = useChurch();
  const params = useSearchParams();
  const router = useRouter();
  const online = useDemoStore((s) => s.online);
  const syncingIds = useDemoStore((s) => s.syncing);
  const mark = useGuideMark();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [undoFor, setUndoFor] = useState<{ rec: AttendanceRecord; member: Member } | null>(null);

  const requested = getService(db, params.get("service"));
  const service = requested && requested.church_id === church.id ? requested : defaultCheckInService(db, church.id);
  const syncing = useMemo(() => new Set(syncingIds), [syncingIds]);

  const members = useMemo(
    () => [...listMembers(db, church.id, scope)].sort((a, b) => a.first_name.localeCompare(b.first_name) || a.last_name.localeCompare(b.last_name)),
    [db, church.id, scope],
  );
  const records = service ? serviceAttendance(db, service.id) : new Map<string, AttendanceRecord>();
  const depts = memberDepartmentsIndex(db, church.id);

  if (!canAccess(role, "attendance")) {
    return <NoAccess body={`${ROLES[role].label}: ${ROLES[role].limits}`} primary={{ href: churchHref(church.slug, ""), label: "Back to dashboard" }} />;
  }
  if (!service) {
    return (
      <EmptyState
        title="No service is open for check-in"
        body="Create a service on the Attendance page, then come back here."
        action={<ButtonLink href={churchHref(church.slug, "attendance")}>Go to Attendance</ButtonLink>}
      />
    );
  }

  const inScope = members.filter((m) => records.has(m.id));
  const checkedIn = inScope.length;
  const unsynced = inScope.filter((m) => records.get(m.id)!.sync_state !== "synced").length;
  const pending = inScope.filter((m) => records.get(m.id)!.sync_state === "pending").length;
  const query = q.trim().toLowerCase();
  const visible = members.filter((m) => {
    const has = records.has(m.id);
    if (filter === "in" && !has) return false;
    if (filter === "out" && has) return false;
    if (!query) return true;
    const name = `${m.first_name} ${m.last_name}`.toLowerCase();
    return query.split(/\s+/).every((p) => name.includes(p)) || phoneMatches(m.phone, query);
  });
  const shown = showAll || query ? visible : visible.slice(0, LIMIT);
  const showGuests = scope.kind === "church";
  const openServices = db.services.filter((s) => s.church_id === church.id && !s.closed).sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const tap = (m: Member) => {
    const rec = records.get(m.id);
    const state = rowState(rec, syncing);
    if (service.closed) {
      toast("This service is closed", { tone: "info", body: "Check-ins are locked once a service is closed." });
      return;
    }
    if (state === "none") {
      const result = checkIn(service, m.id, online);
      if (result.ok) {
        if (!online) mark("checkin_offline");
        if (role === "dept_head") mark("checkin_youth");
      }
      return;
    }
    if (state === "syncing") return;
    if (state === "error") {
      if (!online) {
        toast("You're offline", { tone: "warning", body: "Retry once you're back online." });
        return;
      }
      retrySync(rec!.id);
      mark("retry_sync");
      return;
    }
    if (rec!.device === "This device") {
      setUndoFor({ rec: rec!, member: m });
      return;
    }
    toast(`${m.first_name} is already checked in`, { tone: "info", body: `At ${fmtTime(rec!.checked_in_at)} on ${rec!.device}. Each member is counted once per service.` });
  };

  const sync = () => {
    if (!online) {
      toast("You're offline", { tone: "warning", body: "Check-ins stay saved on this device. They sync when you go back online." });
      return;
    }
    const { total } = syncNow();
    if (total === 0) toast(unsynced > 0 ? "Nothing waiting to sync" : "All check-ins are synced", { tone: "info", body: unsynced > 0 ? "Tap the red row to retry the one that failed." : undefined });
  };

  return (
    <div className="-mx-4 -mt-6 flex flex-col sm:mx-0 sm:mt-0 md:mx-auto md:w-full md:max-w-2xl">
      <header className="bg-navy px-4 pb-5 pt-4 text-white sm:rounded-2xl">
        <div className="flex items-start gap-3">
          <Link
            href={churchHref(church.slug, "attendance")}
            aria-label="Back to Attendance"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy-700 hover:bg-navy-600"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold text-white">{service.name}</h1>
            <p className="text-sm text-navy-200">
              {fmtDate(service.starts_at, "EEE d MMM yyyy")} · {fmtTime(service.starts_at)} · {service.location}
            </p>
          </div>
          <Popover
            label="Check-in options"
            align="end"
            trigger={({ open, toggle, id }) => (
              <button
                type="button"
                aria-label="Check-in options"
                aria-expanded={open}
                aria-controls={id}
                onClick={toggle}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy-700 hover:bg-navy-600"
              >
                <MoreVertical className="size-5" aria-hidden />
              </button>
            )}
          >
            {(close) => (
              <div className="w-[min(18rem,calc(100vw-2rem))]">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted">Open services</p>
                {openServices.map((s) => (
                  <MenuItem
                    key={s.id}
                    selected={s.id === service.id}
                    onClick={() => {
                      close();
                      router.replace(`${churchHref(church.slug, "attendance/check-in")}?service=${s.id}`);
                    }}
                  >
                    <span className="flex flex-col">
                      <span className="font-semibold text-navy">{s.name}</span>
                      <span className="text-xs text-muted">{fmtDate(s.starts_at, "EEE d MMM")} · {fmtTime(s.starts_at)}</span>
                    </span>
                  </MenuItem>
                ))}
                <MenuItem
                  onClick={() => {
                    close();
                    router.push(churchHref(church.slug, "attendance"));
                  }}
                >
                  All services
                </MenuItem>
              </div>
            )}
          </Popover>
        </div>
        {!online && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-gold-soft px-3 py-2 text-sm font-medium text-gold-ink">
            <CloudOff className="size-4 shrink-0" aria-hidden />
            You&apos;re offline. Check-ins are saved on this device.
          </p>
        )}
      </header>

      <div className="flex flex-col gap-4 px-4 pt-4 sm:px-0">
        <p className="text-xs text-muted">Demo: this Sunday&apos;s service stays open so you can try check-in on any day of the week.</p>
        {service.closed && (
          <p className="flex items-center gap-2 rounded-xl bg-slate-soft px-3 py-2.5 text-sm text-slate-ink">
            <Lock className="size-4" aria-hidden /> This service is closed. Check-ins are locked.
          </p>
        )}
        {scope.kind === "department" && (
          <p className="rounded-xl bg-navy-50 px-3 py-2.5 text-sm text-navy">Showing {scope.department.name} members only.</p>
        )}

        <div className={cn("grid gap-3", showGuests ? "grid-cols-3" : "grid-cols-2")}>
          <div className="rounded-2xl border border-line bg-white p-3 shadow-card">
            <p className="text-xs text-muted sm:text-sm">Checked in</p>
            <p className="tabular font-heading text-2xl font-extrabold text-navy sm:text-3xl" aria-live="polite">
              {checkedIn}
            </p>
          </div>
          {showGuests && (
            <div className="rounded-2xl border border-line bg-white p-3 shadow-card">
              <p className="text-xs text-muted sm:text-sm" id="guests-label">
                Guests
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Remove a guest"
                  disabled={service.closed || service.guest_count === 0}
                  onClick={() => setGuestCount(service.id, service.guest_count - 1)}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-line-strong text-navy hover:bg-navy-50 disabled:opacity-40"
                >
                  <Minus className="size-4" />
                </button>
                <span className="tabular min-w-7 text-center font-heading text-xl font-extrabold text-navy" aria-live="polite" aria-labelledby="guests-label">
                  {service.guest_count}
                </span>
                <button
                  type="button"
                  aria-label="Add a guest"
                  disabled={service.closed}
                  onClick={() => setGuestCount(service.id, service.guest_count + 1)}
                  className="inline-flex size-9 items-center justify-center rounded-lg bg-navy text-white hover:bg-navy-700 disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-line bg-white p-3 shadow-card">
            <p className="text-xs text-muted sm:text-sm">Not synced</p>
            <p className={cn("tabular font-heading text-2xl font-extrabold sm:text-3xl", unsynced ? "text-gold-ink" : "text-navy")}>{unsynced}</p>
          </div>
        </div>

        <div className="relative">
          <label htmlFor="checkin-search" className="sr-only">
            Search name or last 4 digits
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            id="checkin-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or last 4 digits"
            className="h-13 rounded-2xl pl-12 text-base"
            autoComplete="off"
          />
        </div>
        <Chips
          label="Show"
          value={filter}
          onChange={setFilter}
          items={[
            { id: "all", label: "All", count: members.length },
            { id: "out", label: "Not in", count: members.length - checkedIn },
            { id: "in", label: "Checked in", count: checkedIn },
          ]}
        />

        {shown.length === 0 ? (
          <EmptyState title={query ? "No one matches" : filter === "in" ? "No one checked in yet" : "Everyone is checked in"} body={query ? "Try part of the name, or the last 4 digits of their phone." : undefined} />
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((m) => (
              <CheckInRow key={m.id} member={m} dept={depts.get(m.id)?.[0]?.name ?? "No department"} state={rowState(records.get(m.id), syncing)} onTap={() => tap(m)} />
            ))}
          </ul>
        )}
        {!showAll && !query && visible.length > LIMIT && (
          <Button variant="secondary" onClick={() => setShowAll(true)}>
            Show all {visible.length}
          </Button>
        )}

        <div className="sticky bottom-[4.5rem] z-10 -mx-4 mt-2 flex items-center gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border md:bottom-4">
          <p className="min-w-0 flex-1 text-sm text-ink">
            {unsynced > 0 ? (
              <>
                <span className="font-semibold">{plural(unsynced, "check-in")}</span> saved on this device. Don&apos;t log out or clear browser data.
              </>
            ) : (
              "All check-ins are synced."
            )}
          </p>
          <Button
            variant={online && pending > 0 ? "primary" : "secondary"}
            onClick={sync}
            disabled={syncingIds.length > 0}
            icon={syncingIds.length > 0 ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
          >
            {syncingIds.length > 0 ? "Syncing" : "Sync now"}
          </Button>
        </div>
      </div>

      {undoFor && (
        <Modal
          open
          onClose={() => setUndoFor(null)}
          title={`Undo check-in for ${undoFor.member.first_name} ${undoFor.member.last_name}?`}
          description={`Checked in at ${fmtTime(undoFor.rec.checked_in_at)} on this device.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setUndoFor(null)}>
                Keep check-in
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  undoCheckIn(undoFor.rec.id);
                  toast("Check-in removed", { body: `${undoFor.member.first_name} ${undoFor.member.last_name} is no longer counted for this service.` });
                  setUndoFor(null);
                }}
              >
                Undo check-in
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink">Use this if they were checked in by mistake. Check-ins from other devices can only be changed by the secretary.</p>
        </Modal>
      )}
    </div>
  );
}

const STATE_TEXT: Record<RowState, string> = {
  none: "Tap to check in",
  synced: "Checked in · synced",
  pending: "Saved on device · waiting to sync",
  syncing: "Syncing",
  error: "Sync failed · tap to retry",
};

function CheckInRow({ member, dept, state, onTap }: { member: Member; dept: string; state: RowState; onTap: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onTap}
        aria-label={`${member.first_name} ${member.last_name}, ${dept}. ${STATE_TEXT[state]}`}
        className={cn(
          "flex min-h-[72px] w-full items-center gap-3 rounded-2xl border bg-white px-3 py-3 text-left shadow-card transition-colors active:scale-[0.99] sm:px-4",
          state === "synced" && "border-teal/50",
          (state === "pending" || state === "syncing") && "border-gold bg-gold-soft/40",
          state === "error" && "border-danger/60 bg-danger-soft/40",
          state === "none" && "border-line hover:border-navy-200",
        )}
      >
        <Avatar initials={initials(member.first_name, member.last_name)} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold text-navy">
            {member.first_name} {member.last_name}
          </span>
          <span className="block truncate text-sm text-muted">
            {dept}
            {member.phone && ` · ${formatPhoneShort(member.phone)}`}
          </span>
          <span
            className={cn(
              "block text-sm font-semibold",
              state === "synced" && "text-teal-ink",
              (state === "pending" || state === "syncing") && "text-gold-ink",
              state === "error" && "text-danger-ink",
              state === "none" && "font-normal text-muted",
            )}
          >
            {STATE_TEXT[state]}
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full",
            state === "none" && "border-2 border-line-strong",
            state === "synced" && "bg-teal-ink text-white",
            (state === "pending" || state === "syncing") && "bg-gold text-navy",
            state === "error" && "bg-danger text-white",
          )}
        >
          {state === "synced" || state === "pending" ? <Check className="size-5" /> : state === "syncing" ? <Loader2 className="size-5 animate-spin" /> : state === "error" ? <AlertCircle className="size-5" /> : null}
        </span>
      </button>
    </li>
  );
}
