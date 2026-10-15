"use client";

import { Check, ChevronDown, ListChecks, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDemoStore } from "@/data/store";
import { resetDemo } from "@/data/repo";
import type { RoleId } from "@/data/types";
import { DEFAULT_CHURCH_SLUG } from "@/data/constants";
import { ROLES, ROLE_ORDER } from "@/lib/roles";
import { GUIDE } from "@/lib/guide";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { toast } from "@/components/ui/Toast";
import { GuidePanel } from "./GuidePanel";
import { useGuideMark } from "./hooks";

/**
 * Slim bar on every in-app screen: current role with a switcher, the
 * "Things to try" guide, and reset. Makes it obvious this is a demo.
 */
export function DemoBar({ churchSlug }: { churchSlug: string | null }) {
  const role = useDemoStore((s) => s.role);
  const setRole = useDemoStore((s) => s.setRole);
  const guide = useDemoStore((s) => s.guide);
  const router = useRouter();
  const mark = useGuideMark();
  const [guideOpen, setGuideOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const items = role ? GUIDE[role] : [];
  const done = items.filter((i) => guide[`${role}:${i.key}`]).length;

  const switchTo = (next: RoleId) => {
    if (role && next !== role) mark("switch_role", role);
    if (next !== role) useDemoStore.getState().setSupportSession(null);
    setRole(next);
    if (next === "operator") router.push("/platform/");
    else if (role === "operator" && churchSlug) router.push(`/c/${churchSlug}/`);
    else if (!churchSlug) router.push(`/c/${DEFAULT_CHURCH_SLUG}/`);
    toast(`Now viewing as ${ROLES[next].label}`, { tone: "info", body: ROLES[next].limits });
  };

  return (
    <>
      <div className="sticky top-0 z-30 flex h-11 items-center gap-2 bg-navy-950 px-2 text-sm text-white sm:px-4">
        <span className="hidden rounded-md bg-gold px-2 py-0.5 text-xs font-bold text-navy sm:inline">Demo</span>
        <Popover
          label="Switch demo role"
          className="min-w-0 lg:ml-4"
          trigger={({ open, toggle, id }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={id}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2 font-semibold hover:bg-navy-700"
            >
              <span className="text-navy-200 font-normal">
                <span className="sm:hidden">Role:</span>
                <span className="hidden sm:inline">Viewing as</span>
              </span>
              <span className="truncate">
                <span className="sm:hidden">{role ? ROLES[role].short : "No role"}</span>
                <span className="hidden sm:inline">{role ? ROLES[role].label : "No role"}</span>
              </span>
              <ChevronDown className="size-4 text-navy-200" aria-hidden />
            </button>
          )}
        >
          {(close) => (
            <div className="w-[min(22rem,calc(100vw-1.5rem))]">
              <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted">Switch role</p>
              {ROLE_ORDER.map((r) => (
                <MenuItem
                  key={r}
                  selected={r === role}
                  onClick={() => {
                    close();
                    switchTo(r);
                  }}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold text-navy">{ROLES[r].label}</span>
                    <span className="text-xs text-muted">{ROLES[r].limits}</span>
                  </span>
                  {r === role && <Check className="size-4 shrink-0 text-teal-ink" aria-hidden />}
                </MenuItem>
              ))}
            </div>
          )}
        </Popover>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-lg px-2 font-semibold hover:bg-navy-700 sm:px-3"
          >
            <ListChecks className="size-4 text-gold" aria-hidden />
            Guide
            {items.length > 0 && (
              <span className="tabular rounded-full bg-navy-700 px-1.5 text-xs text-navy-100">
                {done}/{items.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-lg px-2 font-semibold hover:bg-navy-700 sm:px-3"
          >
            <RotateCcw className="size-4 text-navy-200" aria-hidden />
            <span className="sr-only sm:not-sr-only">Reset demo data</span>
          </button>
        </div>
      </div>

      <GuidePanel open={guideOpen} onClose={() => setGuideOpen(false)} />

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset demo data?"
        description="Everything you added or changed in this browser goes back to the starting demo data."
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              Keep my changes
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDemo();
                setResetOpen(false);
                toast("Demo data reset", { body: "Members, check-ins and giving are back to the starting data." });
              }}
            >
              Reset demo data
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink">
          Your current role stays the same. Your progress in the Guide checklist is cleared too.
        </p>
      </Modal>
    </>
  );
}
