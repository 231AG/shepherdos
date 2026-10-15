import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  HeartHandshake,
  Layers,
  LayoutGrid,
  MessageSquareText,
  ScanLine,
  SlidersHorizontal,
  SquareCheckBig,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ModuleId } from "@/lib/access";

export interface NavItem {
  module: ModuleId;
  label: string;
  icon: LucideIcon;
  /** Path under /c/[church]/ ("" is the dashboard). */
  path: string;
}

export const NAV: NavItem[] = [
  { module: "dashboard", label: "Dashboard", icon: LayoutGrid, path: "" },
  { module: "members", label: "Members", icon: Users, path: "members" },
  { module: "attendance", label: "Attendance", icon: SquareCheckBig, path: "attendance" },
  { module: "giving", label: "Giving", icon: CircleDollarSign, path: "giving" },
  { module: "departments", label: "Departments", icon: Layers, path: "departments" },
  { module: "messaging", label: "Messaging", icon: MessageSquareText, path: "messaging" },
  { module: "soul_winning", label: "Soul-winning", icon: HeartHandshake, path: "soul-winning" },
  { module: "reports", label: "Reports", icon: BarChart3, path: "reports" },
  { module: "events", label: "Events", icon: CalendarDays, path: "events" },
  { module: "bible", label: "Bible", icon: BookOpen, path: "bible" },
  { module: "settings", label: "Settings & roles", icon: SlidersHorizontal, path: "settings" },
];

/** Candidates for the 4 phone tabs before "More", in priority order. */
export const MOBILE_PRIMARY: (NavItem & { short: string })[] = [
  { ...NAV[0], short: "Home" },
  { ...NAV[1], short: "Members" },
  { module: "attendance", label: "Sunday check-in", short: "Check-in", icon: ScanLine, path: "attendance/check-in" },
  { ...NAV[3], short: "Giving" },
  { ...NAV[7], short: "Reports" },
  { ...NAV[8], short: "Events" },
];

export function churchHref(slug: string, path: string): string {
  return `/c/${slug}/${path ? `${path}/` : ""}`;
}
