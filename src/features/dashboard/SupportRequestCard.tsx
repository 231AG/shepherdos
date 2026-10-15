"use client";

import { ShieldQuestion } from "lucide-react";
import { decideSupportRequest, pendingGrantFor, useDb } from "@/data/repo";
import { fmtTime } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";

/** Church admin (pastor) approves or denies a ComNet support access request. */
export function SupportRequestCard() {
  const db = useDb();
  const { church, role, persona } = useChurch();
  const request = role === "pastor" ? pendingGrantFor(db, church.id) : undefined;
  if (!request) return null;
  const decide = (approve: boolean) => {
    decideSupportRequest(request.id, church, approve, `${persona.display} (Pastor)`);
    toast(approve ? "Support access approved" : "Support request denied", {
      body: approve ? "ComNet can view members and attendance, read-only, for 2 hours. Giving stays private." : "ComNet has been told. Nothing was shared.",
    });
  };
  return (
    <section aria-labelledby="support-request" className="flex flex-col gap-4 rounded-2xl border border-gold bg-gold-soft p-4 sm:flex-row sm:items-center">
      <ShieldQuestion className="size-6 shrink-0 text-gold-ink" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 id="support-request" className="text-base font-bold">
          ComNet IT Solutions asked for support access
        </h2>
        <p className="mt-0.5 text-sm text-ink">
          {request.operator_name} at {fmtTime(request.created_at)}: &ldquo;{request.reason}&rdquo;. If approved, they can view members and attendance, read-only, for 2 hours.
          Giving is never shared.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" onClick={() => decide(false)}>
          Deny
        </Button>
        <Button onClick={() => decide(true)}>Approve for 2 hours</Button>
      </div>
    </section>
  );
}
