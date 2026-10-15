"use client";

import { WifiOff } from "lucide-react";
import { useDemoStore } from "@/data/store";

export function OfflineBanner() {
  const online = useDemoStore((s) => s.online);
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-3 border-b border-gold/60 bg-gold-soft px-4 py-2.5 text-sm text-gold-ink lg:px-6">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold">You&apos;re offline.</span> Check-ins and giving are saved on this device and sync when you reconnect.
      </p>
    </div>
  );
}
