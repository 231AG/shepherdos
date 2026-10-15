import type { RoleId } from "@/data/types";

export interface RoleMeta {
  id: RoleId;
  label: string;
  /** Compact label for phone-width bars. */
  short: string;
  /** One line on the demo sign-in card. */
  summary: string;
  /** What changes in the app for this role, shown in the guide. */
  limits: string;
}

export const ROLES: Record<RoleId, RoleMeta> = {
  pastor: {
    id: "pastor",
    short: "Pastor",
    label: "Pastor",
    summary: "Sees the whole church at a glance. Giving shows as totals unless the church allows more.",
    limits: "Broad view of every module. Giving detail follows the church setting (totals only by default).",
  },
  secretary: {
    id: "secretary",
    short: "Secretary",
    label: "Secretary",
    summary: "Runs members, imports, Sunday check-in, events and SMS. No access to the giving ledger.",
    limits: "Members, import, attendance, events, messaging and soul-winning. Giving is hidden.",
  },
  treasurer: {
    id: "treasurer",
    short: "Treasurer",
    label: "Treasurer",
    summary: "Records and reverses giving, closes the day and runs financial reports. Member phones are hidden.",
    limits: "Giving and financial reports. Member contact details are hidden for this role.",
  },
  dept_head: {
    id: "dept_head",
    short: "Youth head",
    label: "Department head (Youth)",
    summary: "Sees only Youth department members and their attendance.",
    limits: "Scoped to the Youth department. Other members and all giving are hidden.",
  },
  operator: {
    id: "operator",
    short: "Operator",
    label: "Platform operator (ComNet)",
    summary: "Manages churches, subscriptions and SMS credits. Church records need an approved support grant.",
    limits: "Platform console only. Church content opens only through a time-limited support grant.",
  },
};

export const ROLE_ORDER: RoleId[] = ["pastor", "secretary", "treasurer", "dept_head", "operator"];
