"use client";

import { ArrowLeft, Hammer } from "lucide-react";
import { canAccess, type ModuleId } from "@/lib/access";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ROLES } from "@/lib/roles";

/**
 * Placeholder for modules scheduled in a later build phase. Explains what the
 * screen will do, so reviewers never hit a blank page.
 */
export function ModulePreview({
  module,
  title,
  phase,
  points,
}: {
  module: ModuleId;
  title: string;
  phase: number;
  points: string[];
}) {
  const { church, role } = useChurch();
  if (!canAccess(role, module, church.settings)) {
    return (
      <NoAccess
        body={<>{ROLES[role].label}: {ROLES[role].limits}</>}
        primary={{ href: churchHref(church.slug, ""), label: "Back to dashboard" }}
      />
    );
  }
  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Card className="mt-6 p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-gold-soft text-gold-ink">
            <Hammer className="size-5" aria-hidden />
          </span>
          <p className="font-semibold text-navy">This screen arrives in build phase {phase} of the demo.</p>
        </div>
        <p className="mt-4 text-sm text-muted">What it will let {church.short_name} do:</p>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-ink">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <ButtonLink href={churchHref(church.slug, "")} variant="secondary" className="mt-6" icon={<ArrowLeft className="size-4" aria-hidden />}>
          Back to dashboard
        </ButtonLink>
      </Card>
    </div>
  );
}
