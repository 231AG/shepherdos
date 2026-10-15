import type { ChurchSettings, RoleId } from "@/data/types";

export type ModuleId =
  | "dashboard"
  | "members"
  | "attendance"
  | "giving"
  | "departments"
  | "messaging"
  | "soul_winning"
  | "reports"
  | "events"
  | "bible"
  | "settings"
  | "platform";

/**
 * Role matrix. In the full build the same rules are enforced by Postgres RLS;
 * here they decide which screens and data a demo role can reach.
 */
const MATRIX: Record<ModuleId, RoleId[]> = {
  dashboard: ["pastor", "secretary", "treasurer", "dept_head"],
  members: ["pastor", "secretary", "treasurer", "dept_head"],
  attendance: ["pastor", "secretary", "dept_head"],
  giving: ["pastor", "treasurer"],
  departments: ["pastor", "secretary", "dept_head"],
  messaging: ["pastor", "secretary"],
  soul_winning: ["pastor", "secretary"],
  reports: ["pastor", "secretary", "treasurer"],
  events: ["pastor", "secretary", "treasurer", "dept_head"],
  bible: ["pastor", "secretary", "treasurer", "dept_head"],
  settings: ["pastor"],
  platform: ["operator"],
};

export function canAccess(role: RoleId | null, module: ModuleId, settings?: ChurchSettings): boolean {
  if (!role) return false;
  if (!MATRIX[module].includes(role)) return false;
  if (module === "giving" && role === "pastor" && settings?.pastor_giving_visibility === "none") return false;
  return true;
}

/** Pastor sees the ledger rows only when the church allows it. */
export function canSeeLedger(role: RoleId | null, settings: ChurchSettings): boolean {
  if (role === "treasurer") return true;
  return role === "pastor" && settings.pastor_giving_visibility === "ledger";
}

export function canSeeGivingTotals(role: RoleId | null, settings: ChurchSettings): boolean {
  if (role === "treasurer") return true;
  return role === "pastor" && settings.pastor_giving_visibility !== "none";
}

/** Treasurers see names but not contact details. */
export function canSeeContacts(role: RoleId | null): boolean {
  return role === "pastor" || role === "secretary" || role === "dept_head";
}

export function canSeeFinancialReports(role: RoleId | null): boolean {
  return role === "pastor" || role === "treasurer";
}
