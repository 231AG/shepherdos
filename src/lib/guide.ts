import type { RoleId } from "@/data/types";

/**
 * "Things to try" per role. Items tick themselves off when the visitor does
 * them: actions across the app call `markGuide(key)`.
 */
export interface GuideItem {
  key: string;
  label: string;
  hint: string;
}

export const GUIDE: Record<RoleId, GuideItem[]> = {
  pastor: [
    { key: "view_dashboard", label: "Read the church dashboard", hint: "Members, attendance and this month's giving on one screen." },
    { key: "switch_church", label: "Switch to the other church", hint: "Use the church name at the top. Each church's data is fully separate." },
    { key: "toggle_offline", label: "Go offline and back online", hint: "Use the Online switch in the header to simulate losing the network." },
    { key: "log_note", label: "Log a follow-up note", hint: "Pick a task under Follow-up tasks and record what happened." },
    { key: "switch_role", label: "See the same church as the Treasurer", hint: "Use Switch role in the demo bar." },
  ],
  secretary: [
    { key: "view_dashboard", label: "Read the church dashboard", hint: "Notice there is no giving card for this role." },
    { key: "switch_church", label: "Switch to the other church", hint: "Use the church name at the top." },
    { key: "toggle_offline", label: "Go offline and back online", hint: "Use the Online switch in the header." },
    { key: "log_note", label: "Log a follow-up note", hint: "Pick a task under Follow-up tasks." },
    { key: "switch_role", label: "Compare with the Pastor's view", hint: "Use Switch role in the demo bar." },
  ],
  treasurer: [
    { key: "view_dashboard", label: "Read the giving dashboard", hint: "LRD and USD are always shown side by side, never added together." },
    { key: "view_drafts", label: "Spot the offline drafts", hint: "Drafts captured offline are not counted in posted totals." },
    { key: "switch_church", label: "Switch to the other church", hint: "Use the church name at the top." },
    { key: "toggle_offline", label: "Go offline and back online", hint: "Use the Online switch in the header." },
    { key: "switch_role", label: "Compare with the Pastor's view", hint: "Pastors see totals only by default." },
  ],
  dept_head: [
    { key: "view_dashboard", label: "Read the Youth dashboard", hint: "Every number is scoped to the Youth department." },
    { key: "log_note", label: "Follow up a Youth member", hint: "Log a note on a Youth follow-up task." },
    { key: "switch_church", label: "Switch to the other church", hint: "The Youth scope applies there too." },
    { key: "switch_role", label: "Compare with the Pastor's view", hint: "See how much more a Pastor sees." },
  ],
  operator: [
    { key: "view_platform", label: "Review the churches table", hint: "Plans, renewals, staff and SMS credits per church." },
    { key: "switch_role", label: "Switch to a church role", hint: "Church records are only visible to church staff." },
  ],
};
