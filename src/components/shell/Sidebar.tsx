"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";
import { fmtDate } from "@/lib/dates";
import { useChurch } from "./ChurchContext";
import { churchHref, NAV } from "./nav";

export function isActive(pathname: string, href: string, isRoot: boolean): boolean {
  const p = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return isRoot ? p === href : p.startsWith(href);
}

/**
 * Desktop: full sidebar. Tablet (md to lg): icon rail that expands on demand.
 * Phones use the bottom navigation instead.
 */
export function Sidebar() {
  const { church, can } = useChurch();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const items = NAV.filter((n) => can(n.module));

  return (
    <>
      {expanded && (
        <div aria-hidden className="fixed inset-0 top-11 z-20 bg-navy-950/40 lg:hidden" onClick={() => setExpanded(false)} />
      )}
      <aside
        aria-label="Main navigation"
        className={cn(
          "sticky top-11 z-20 hidden h-[calc(100dvh-2.75rem)] shrink-0 flex-col bg-navy text-white md:flex",
          expanded ? "w-64 max-lg:fixed max-lg:left-0" : "w-[76px] lg:w-64",
        )}
      >
        <div className={cn("flex h-16 items-center px-4", !expanded && "max-lg:justify-center max-lg:px-0")}>
          <Link href={churchHref(church.slug, "")} aria-label="ShepherdOS dashboard">
            <Logo tone="onDark" className={cn(!expanded && "max-lg:hidden")} />
            <Logo variant="mark" className={cn("hidden", !expanded && "max-lg:block")} />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const href = churchHref(church.slug, item.path);
              const active = isActive(pathname, href, item.path === "");
              const Icon = item.icon;
              return (
                <li key={item.module}>
                  <Link
                    href={href}
                    onClick={() => setExpanded(false)}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                      active ? "bg-white text-navy shadow-card" : "text-navy-100 hover:bg-navy-700 hover:text-white",
                      !expanded && "max-lg:justify-center max-lg:px-0",
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    <span className={cn(!expanded && "max-lg:sr-only")}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
            aria-expanded={expanded}
            className="mb-2 flex h-11 w-full items-center justify-center rounded-xl text-navy-100 hover:bg-navy-700 lg:hidden"
          >
            {expanded ? <PanelLeftClose className="size-5" /> : <PanelLeftOpen className="size-5" />}
          </button>
          <div className={cn("rounded-xl bg-navy-700/60 px-3 py-2.5", !expanded && "max-lg:hidden")}>
            <p className="text-xs font-semibold text-white">Annual hosting · active</p>
            <p className="mt-0.5 text-xs text-navy-200">
              {church.renewal_on ? `Renews ${fmtDate(church.renewal_on)}` : "Renewal not set"}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
