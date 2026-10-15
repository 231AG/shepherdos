"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { endSupportSession } from "@/data/repo";
import type { Church } from "@/data/types";
import { formatCountdown, useNow } from "@/lib/useNow";
import { toast } from "@/components/ui/Toast";

/** Shown while a ComNet operator is inside a church under a support grant. */
export function SupportBar({ church, expiresAt, approvedBy }: { church: Church; expiresAt: string; approvedBy: string }) {
  const now = useNow(1000);
  const router = useRouter();
  const left = new Date(expiresAt).getTime() - now.getTime();
  useEffect(() => {
    if (left > 0) return;
    endSupportSession(church, "expired");
    toast("Support access expired", { tone: "info", body: `${church.short_name} can no longer be opened by ComNet until a new grant is approved.` });
    router.push("/platform/");
  }, [left, church, router]);
  return (
    <div role="status" className="sticky top-[6.75rem] z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-teal/40 bg-teal-soft px-4 py-2.5 text-sm text-teal-ink lg:px-6">
      <ShieldCheck className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Support session, read-only.</span> Granted by {approvedBy}. Logged to {church.short_name}&apos;s audit trail.
      </p>
      <span className="tabular font-semibold">Expires in {formatCountdown(left)}</span>
      <button
        type="button"
        onClick={() => {
          endSupportSession(church, "ended");
          router.push("/platform/");
        }}
        className="inline-flex h-9 items-center rounded-lg border border-teal-ink/30 bg-white px-3 font-semibold text-teal-ink hover:bg-teal-soft"
      >
        Leave session
      </button>
    </div>
  );
}
