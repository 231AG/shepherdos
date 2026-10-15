"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useDemoStore } from "@/data/store";
import { GUIDE } from "@/lib/guide";
import { ROLES } from "@/lib/roles";
import { Sheet } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";

export function GuidePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const role = useDemoStore((s) => s.role);
  const guide = useDemoStore((s) => s.guide);
  if (!role) return null;
  const items = GUIDE[role];
  const done = items.filter((i) => guide[`${role}:${i.key}`]).length;
  return (
    <Sheet open={open} onClose={onClose} title={`Things to try as ${ROLES[role].label}`} description="Items tick off on their own as you do them.">
      <div className="mb-4 rounded-2xl bg-navy-50 p-4">
        <p className="text-sm font-semibold text-navy">What this role can do</p>
        <p className="mt-1 text-sm text-ink">{ROLES[role].limits}</p>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-navy">
          {done} of {items.length} done
        </p>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-navy-100" aria-hidden>
          <div className="h-full rounded-full bg-teal transition-[width] duration-300" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      </div>
      <ol className="flex flex-col gap-2">
        {items.map((item) => {
          const isDone = !!guide[`${role}:${item.key}`];
          return (
            <li key={item.key} className={cn("flex gap-3 rounded-2xl border p-4", isDone ? "border-teal-soft bg-teal-soft/50" : "border-line bg-white")}>
              {isDone ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal-ink" aria-label="Done" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-line-strong" aria-label="Not done yet" />
              )}
              <div>
                <p className={cn("text-sm font-semibold", isDone ? "text-teal-ink" : "text-navy")}>{item.label}</p>
                <p className="mt-0.5 text-sm text-muted">{item.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
