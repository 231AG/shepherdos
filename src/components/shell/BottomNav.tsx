"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Sheet } from "@/components/ui/Dialog";
import { useChurch } from "./ChurchContext";
import { churchHref, MOBILE_PRIMARY, NAV } from "./nav";
import { isActive } from "./Sidebar";

/** Phone navigation: four key actions for the role, plus "More". */
export function BottomNav() {
  const { church, can } = useChurch();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = MOBILE_PRIMARY.filter((n) => can(n.module)).slice(0, 4);
  const primaryPaths = new Set(primary.map((p) => p.path));
  const rest = NAV.filter((n) => can(n.module) && !primaryPaths.has(n.path));
  const checkinActive = pathname.includes("/attendance/check-in");

  return (
    <>
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const href = churchHref(church.slug, item.path);
            const active =
              item.path === "attendance/check-in"
                ? checkinActive
                : item.path === "attendance"
                  ? isActive(pathname, href, false) && !checkinActive
                  : isActive(pathname, href, item.path === "");
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold",
                    active ? "text-teal-ink" : "text-muted hover:text-navy",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.short}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted hover:text-navy"
            >
              <Menu className="size-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More" description={church.name}>
        <ul className="flex flex-col gap-1">
          {rest.map((item) => {
            const Icon = item.icon;
            const href = churchHref(church.slug, item.path);
            return (
              <li key={item.path}>
                <Link
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className="flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-navy hover:bg-navy-50"
                >
                  <Icon className="size-5 text-navy-600" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
