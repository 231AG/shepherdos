"use client";

import { ArrowRight, BookUser, Building2, CircleDollarSign, ClipboardList, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import type { RoleId } from "@/data/types";
import { useDemoStore } from "@/data/store";
import { DEFAULT_CHURCH_SLUG } from "@/data/constants";
import { ROLES, ROLE_ORDER } from "@/lib/roles";
import { cn } from "@/lib/cn";

const ICONS: Record<RoleId, typeof Users> = {
  pastor: BookUser,
  secretary: ClipboardList,
  treasurer: CircleDollarSign,
  dept_head: Users,
  operator: Building2,
};

const PEOPLE: Record<RoleId, string> = {
  pastor: "Rev. James Kollie",
  secretary: "Patience Toe",
  treasurer: "Martha Doe",
  dept_head: "Bro. Emmanuel Flomo",
  operator: "Aaron Sumo, ComNet IT Solutions",
};

/** Role cards. Picking one signs in to the demo (no passwords). */
export function RolePicker({ churchSlug, compact = false }: { churchSlug?: string; compact?: boolean }) {
  const setRole = useDemoStore((s) => s.setRole);
  const current = useDemoStore((s) => s.role);
  const router = useRouter();

  const pick = (role: RoleId) => {
    setRole(role);
    router.push(role === "operator" ? "/platform/" : `/c/${churchSlug ?? DEFAULT_CHURCH_SLUG}/`);
  };

  const card = (r: RoleId, wide = false) => {
    const Icon = ICONS[r];
    const isOperator = r === "operator";
    return (
      <button
        type="button"
        onClick={() => pick(r)}
        className={cn(
          "group flex h-full w-full rounded-2xl border bg-white p-5 text-left shadow-card transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-raised",
          wide ? "flex-col gap-3 sm:flex-row sm:items-center sm:gap-6" : "flex-col",
          current === r ? "border-teal" : "border-line",
        )}
      >
        <span className="flex items-center gap-3 sm:shrink-0">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", isOperator ? "bg-navy text-gold" : "bg-teal-soft text-teal-ink")}>
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-heading text-base font-bold text-navy">{ROLES[r].label}</span>
            <span className="block truncate text-xs text-muted">{PEOPLE[r]}</span>
          </span>
        </span>
        <span className={cn("flex-1 text-sm leading-relaxed text-ink", !wide && "mt-3")}>{ROLES[r].summary}</span>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-teal-ink", !wide && "mt-4")}>
          {current === r ? "Continue as this role" : "Enter as this role"}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted">Church staff</h2>
        <ul className={cn("grid gap-3 sm:grid-cols-2", !compact && "xl:grid-cols-4")}>
          {ROLE_ORDER.filter((r) => r !== "operator").map((r) => (
            <li key={r}>{card(r)}</li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted">Platform team at ComNet IT Solutions</h2>
        {card("operator", true)}
      </div>
    </div>
  );
}
