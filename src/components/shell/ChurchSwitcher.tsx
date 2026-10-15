"use client";

import { Check, ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { listDemoChurches, useDb } from "@/data/repo";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useChurch } from "./ChurchContext";
import { useGuideMark } from "./hooks";

function ChurchBadge({ initials, className }: { initials: string; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-ink text-[11px] font-bold text-white", className)}>
      {initials}
    </span>
  );
}

/** Switching church shows the same screen with the other church's data. */
export function ChurchSwitcher() {
  const db = useDb();
  const { church } = useChurch();
  const pathname = usePathname();
  const router = useRouter();
  const mark = useGuideMark();
  const churches = listDemoChurches(db);

  return (
    <Popover
      label="Switch church"
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={id}
          aria-label={`Current church: ${church.name}. Switch church`}
          className="inline-flex h-11 min-w-0 max-w-full items-center gap-2 rounded-xl border border-line bg-white px-2 text-sm font-semibold text-navy shadow-card hover:bg-navy-50 sm:px-3"
        >
          <ChurchBadge initials={church.initials} />
          <span className="min-w-0 truncate">
            <span className="sm:hidden">{church.short_name}</span>
            <span className="hidden sm:inline">
              {church.name} · {church.city}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div className="w-[min(22rem,calc(100vw-2rem))]">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted">Your churches</p>
          {churches.map((c) => (
            <MenuItem
              key={c.id}
              selected={c.id === church.id}
              onClick={() => {
                close();
                if (c.id === church.id) return;
                mark("switch_church");
                router.push(pathname.replace(`/c/${church.slug}`, `/c/${c.slug}`));
                toast(`Switched to ${c.name}`, { tone: "info", body: "Each church's data is completely separate." });
              }}
            >
              <ChurchBadge initials={c.initials} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold text-navy">{c.name}</span>
                <span className="text-xs text-muted">
                  {c.city}, {c.county}
                </span>
              </span>
              {c.id === church.id && <Check className="size-4 text-teal-ink" aria-hidden />}
            </MenuItem>
          ))}
          <p className="px-3 pb-2 pt-1 text-xs text-muted">Staff only see churches they belong to. Data never crosses between churches.</p>
        </div>
      )}
    </Popover>
  );
}
