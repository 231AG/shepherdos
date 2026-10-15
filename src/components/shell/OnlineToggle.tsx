"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useDemoStore } from "@/data/store";
import { syncNow } from "@/data/repo";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useGuideMark } from "./hooks";

/** Simulated network switch. Going back online replays the offline queue. */
export function OnlineToggle({ compact = false }: { compact?: boolean }) {
  const online = useDemoStore((s) => s.online);
  const setOnline = useDemoStore((s) => s.setOnline);
  const mark = useGuideMark();

  const toggle = () => {
    if (online) {
      setOnline(false);
      toast("You're offline (simulated)", {
        tone: "warning",
        body: "Check-ins and giving are saved on this device until you reconnect.",
      });
    } else {
      setOnline(true);
      mark("toggle_offline");
      const result = syncNow();
      toast(result.total === 0 ? "Back online. Nothing was waiting to sync." : `Back online. Syncing ${result.total} saved item${result.total === 1 ? "" : "s"}.`);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={online}
      aria-label="Network connection (simulated)"
      onClick={toggle}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-1.5 text-sm font-semibold transition-colors sm:pr-3",
        online ? "border-teal-soft bg-teal-soft text-teal-ink hover:border-teal" : "border-gold bg-gold-soft text-gold-ink hover:border-gold-ink",
      )}
    >
      <span className={cn("relative h-6 w-10 rounded-full transition-colors", online ? "bg-teal-ink" : "bg-line-strong")} aria-hidden>
        <span className={cn("absolute top-1 size-4 rounded-full bg-white shadow-card transition-transform", online ? "translate-x-5" : "translate-x-1")} />
      </span>
      {online ? <Wifi className="hidden size-4 sm:block" aria-hidden /> : <WifiOff className="hidden size-4 sm:block" aria-hidden />}
      <span className={cn(compact && "sr-only sm:not-sr-only")}>{online ? "Online" : "Offline"}</span>
    </button>
  );
}
