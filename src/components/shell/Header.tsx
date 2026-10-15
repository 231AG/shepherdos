"use client";

import { Bell, LogOut, Search, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { listOpenTasks, pendingSyncCount, upcomingEvents, useDb } from "@/data/repo";
import { canSeeGivingTotals } from "@/lib/access";
import { fmtDate } from "@/lib/dates";
import { Avatar } from "@/components/ui/misc";
import { IconButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { useChurch } from "./ChurchContext";
import { ChurchSwitcher } from "./ChurchSwitcher";
import { churchHref } from "./nav";
import { OnlineToggle } from "./OnlineToggle";
import { useDemoStore } from "@/data/store";

function SyncPill() {
  const db = useDb();
  const { church } = useChurch();
  const online = useDemoStore((s) => s.online);
  const pending = pendingSyncCount(db, church.id);
  if (pending === 0 && online) {
    return (
      <span className="hidden h-8 shrink-0 items-center gap-2 rounded-full bg-teal-soft px-3 text-xs font-semibold text-teal-ink min-[1400px]:inline-flex">
        <span className="size-2 rounded-full bg-teal" aria-hidden />
        All changes synced
      </span>
    );
  }
  return (
    <span className="hidden h-8 shrink-0 items-center gap-2 rounded-full bg-gold-soft px-3 text-xs font-semibold text-gold-ink min-[1400px]:inline-flex">
      <span className="size-2 rounded-full bg-gold" aria-hidden />
      {pending} waiting to sync
    </span>
  );
}

function Notifications() {
  const db = useDb();
  const { church, role, scope } = useChurch();
  const drafts = db.giving_drafts.filter((d) => d.church_id === church.id && d.status === "pending_review").length;
  const tasks = listOpenTasks(db, church.id, scope);
  const overdue = tasks.filter((t) => t.task.due_on < db.now.toISOString().slice(0, 10)).length;
  const next = upcomingEvents(db, church.id, { limit: 1, departmentId: scope.kind === "department" ? scope.department.id : undefined })[0];
  const items: { title: string; body: string; href: string }[] = [];
  if (drafts > 0 && canSeeGivingTotals(role, church.settings) && role === "treasurer")
    items.push({ title: `${drafts} offline giving drafts`, body: "Captured on an usher tablet. Review before closing the day.", href: churchHref(church.slug, "giving") });
  if (overdue > 0) items.push({ title: `${overdue} overdue follow-up${overdue === 1 ? "" : "s"}`, body: "Pastoral care tasks past their due date.", href: churchHref(church.slug, "") });
  if (next) items.push({ title: next.title, body: `${fmtDate(next.starts_at, "EEE d MMM, h:mm a")} · ${next.location}`, href: churchHref(church.slug, "events") });

  return (
    <Popover
      label="Notifications"
      align="end"
      trigger={({ open, toggle, id }) => (
        <span className="relative">
          <IconButton aria-label={`Notifications, ${items.length} new`} aria-expanded={open} aria-controls={id} onClick={toggle}>
            <Bell className="size-5" />
          </IconButton>
          {items.length > 0 && <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger" />}
        </span>
      )}
    >
      {(close) => (
        <div className="w-[min(20rem,calc(100vw-2rem))]">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted">Notifications</p>
          {items.length === 0 && <p className="px-3 py-4 text-sm text-muted">You&apos;re all caught up.</p>}
          {items.map((n) => (
            <Link key={n.title} href={n.href} onClick={close} className="block rounded-xl px-3 py-2.5 hover:bg-navy-50">
              <span className="block text-sm font-semibold text-navy">{n.title}</span>
              <span className="mt-0.5 block text-xs text-muted">{n.body}</span>
            </Link>
          ))}
        </div>
      )}
    </Popover>
  );
}

function UserMenu() {
  const { persona } = useChurch();
  const router = useRouter();
  return (
    <Popover
      label="Account"
      align="end"
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={id}
          aria-label={`Account: ${persona.display}, ${persona.title}`}
          className="flex h-11 items-center gap-2.5 rounded-xl px-1.5 text-left hover:bg-navy-50"
        >
          <Avatar initials={persona.initials} tone="navy" size="sm" />
          <span className="hidden flex-col leading-tight lg:flex">
            <span className="text-sm font-semibold text-navy">{persona.display}</span>
            <span className="text-xs text-muted">{persona.title}</span>
          </span>
        </button>
      )}
    >
      {(close) => (
        <div className="w-64">
          <div className="px-3 pb-2 pt-2">
            <p className="text-sm font-semibold text-navy">{persona.display}</p>
            <p className="text-xs text-muted">{persona.title}</p>
          </div>
          <MenuItem onClick={() => { close(); router.push("/demo/"); }}>
            <UserRoundCog className="size-4 text-navy-600" aria-hidden />
            Switch role
          </MenuItem>
          <MenuItem onClick={() => { close(); router.push("/"); }}>
            <LogOut className="size-4 text-navy-600" aria-hidden />
            Leave the demo
          </MenuItem>
        </div>
      )}
    </Popover>
  );
}

export function Header() {
  const { church } = useChurch();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const go = (query: string) => {
    setSearchOpen(false);
    router.push(`${churchHref(church.slug, "members")}?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="sticky top-11 z-20 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 shrink">
          <ChurchSwitcher />
        </div>
        <form
          role="search"
          className="relative hidden min-w-40 max-w-xs flex-1 lg:block"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) go(q);
          }}
        >
          <label htmlFor="global-search" className="sr-only">
            Search members by name or phone
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input id="global-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members or phone" className="pl-9" />
        </form>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2">
          <SyncPill />
          <OnlineToggle compact />
          <IconButton aria-label="Search members" className="lg:hidden" onClick={() => setSearchOpen(true)}>
            <Search className="size-5" />
          </IconButton>
          <div className="hidden sm:block">
            <Notifications />
          </div>
          <UserMenu />
        </div>
      </div>
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Search members" description="Name, or the last 4 digits of a phone number.">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) go(q);
          }}
          className="flex gap-2"
        >
          <label htmlFor="mobile-search" className="sr-only">
            Search members
          </label>
          <Input id="mobile-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Kollie or 4521" />
          <button type="submit" className="h-11 shrink-0 rounded-xl bg-navy px-4 text-sm font-semibold text-white">
            Search
          </button>
        </form>
      </Modal>
    </header>
  );
}
