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
    { key: "open_member", label: "Open a member's profile", hint: "Members, then tap any name. Status, attendance and giving in one place." },
    { key: "switch_church", label: "Switch to the other church", hint: "Use the church name at the top. Each church's data is fully separate." },
    { key: "checkin_offline", label: "Check someone in while offline", hint: "Go to Check-in, switch to Offline in the header, tap a name, then go back online." },
    { key: "view_giving", label: "See giving as totals only", hint: "Open Giving. By default a pastor sees totals, not individual entries." },
    { key: "switch_role", label: "See the same church as the Treasurer", hint: "Use Switch role in the demo bar." },
  ],
  secretary: [
    { key: "import_sample", label: "Import the sample notebook file", hint: "Members, Import spreadsheet, then Use sample notebook file. Resolve the 3 duplicates." },
    { key: "add_member", label: "Add a new member", hint: "Type a phone like 0886 123 456 and watch it become +231." },
    { key: "checkin_offline", label: "Check someone in while offline", hint: "Switch to Offline in the header, tap a name, then go back online." },
    { key: "retry_sync", label: "Retry the check-in that failed", hint: "On Check-in, tap the red row (Felix Massaquoi) to retry." },
    { key: "send_sms", label: "Send an SMS to a department", hint: "Messaging: pick a department, write a message and watch the cost and delivery." },
    { key: "convert_prospect", label: "Convert a prospect to a member", hint: "Soul-winning: open someone in Ready to join and convert them." },
  ],
  treasurer: [
    { key: "record_giving", label: "Record a gift", hint: "Giving, then Record giving. Pick LRD or USD, a member and an amount, then Post entry." },
    { key: "reverse_entry", label: "Reverse a posted entry", hint: "Posted entries can't be edited. Use Reverse on a ledger row and give a reason." },
    { key: "review_drafts", label: "Review the offline drafts", hint: "Two drafts from an usher's tablet wait on Sunday's ledger. Post or discard them." },
    { key: "close_day", label: "Close the day", hint: "Close day only unlocks once every draft is reviewed." },
    { key: "export_csv", label: "Export the ledger", hint: "Export CSV downloads the service's ledger." },
    { key: "hidden_contacts", label: "Notice hidden phone numbers", hint: "Open Members: treasurers see names but not contact details." },
  ],
  dept_head: [
    { key: "view_dashboard", label: "Read the Youth dashboard", hint: "Every number is scoped to the Youth department." },
    { key: "youth_members", label: "Browse Youth members", hint: "Members shows only your department." },
    { key: "checkin_youth", label: "Check in a Youth member", hint: "Check-in lists only Youth members for you." },
    { key: "log_note", label: "Follow up a Youth member", hint: "Log a note on a Youth follow-up task." },
    { key: "switch_role", label: "Compare with the Pastor's view", hint: "See how much more a Pastor sees." },
  ],
  operator: [
    { key: "view_platform", label: "Review the churches table", hint: "Plans, renewals, staff and SMS credits per church." },
    { key: "open_support", label: "Open a church under a support grant", hint: "Support access, then Open church. It's read-only and counts down." },
    { key: "request_access", label: "Request access to another church", hint: "Ask Living Waters for access. Its pastor approves on their dashboard." },
    { key: "provision_church", label: "Provision a new church", hint: "Use Provision church. The invite is simulated." },
    { key: "switch_role", label: "Switch to a church role", hint: "Church records are only visible to church staff." },
  ],
};
