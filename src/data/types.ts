/**
 * Domain types. These mirror the data model in the product spec (section 6)
 * so the full build can keep them when the mock repository is replaced by
 * Supabase. Every church-owned record carries `church_id`; ids are UUIDs;
 * timestamps are ISO strings; money is integer minor units plus a currency.
 */

export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO timestamp

export type Currency = "LRD" | "USD";
export const CURRENCIES: readonly Currency[] = ["LRD", "USD"] as const;

export type RoleId = "pastor" | "secretary" | "treasurer" | "dept_head" | "operator";
export type ChurchRole = Exclude<RoleId, "operator">;

export type PastorGivingVisibility = "none" | "totals" | "ledger";

export interface ChurchSettings {
  /** Members are "New" for this many days after joining. */
  new_days: number;
  /** Members become "Inactive" after this many weeks without attendance. */
  inactive_weeks: number;
  pastor_giving_visibility: PastorGivingVisibility;
}

export type SubscriptionStatus = "active" | "renewal_due" | "overdue_read_only" | "onboarding";

export interface Church {
  id: UUID;
  slug: string;
  name: string;
  short_name: string;
  initials: string;
  city: string;
  county: string;
  plan: "Pilot · annual" | "Annual";
  renewal_on: ISODate | null;
  subscription_status: SubscriptionStatus;
  hosting_fee_minor: number; // USD minor units per year
  sms_credits: number;
  staff_count: number;
  /** Only the two demo churches have full content. */
  has_content: boolean;
  member_count_hint: number | null;
  settings: ChurchSettings;
  created_at: ISODateTime;
}

export interface StaffUser {
  id: UUID;
  church_id: UUID;
  name: string;
  display_name: string;
  role: ChurchRole;
  /** Department heads are scoped to one department. */
  department_id: UUID | null;
  mfa: boolean;
  created_at: ISODateTime;
}

export interface Department {
  id: UUID;
  church_id: UUID;
  name: string;
  short_name: string;
  leader_member_id: UUID | null;
  created_at: ISODateTime;
}

export type ExceptionKind = "homebound" | "leave" | "pastoral";

export interface MemberException {
  kind: ExceptionKind;
  reason: string;
  until: ISODate | null;
}

export interface Member {
  id: UUID;
  church_id: UUID;
  first_name: string;
  last_name: string;
  /** E.164, e.g. +231771234567. Null when unknown. */
  phone: string | null;
  gender: "female" | "male";
  joined_on: ISODate;
  exception: MemberException | null;
  sms_opt_out: boolean;
  household: string | null;
  converted_from_prospect_id: UUID | null;
  created_at: ISODateTime;
}

export interface MemberDepartment {
  id: UUID;
  church_id: UUID;
  member_id: UUID;
  department_id: UUID;
  created_at: ISODateTime;
}

export type ServiceKind = "sunday" | "midweek" | "special";

export interface Service {
  id: UUID;
  church_id: UUID;
  kind: ServiceKind;
  name: string;
  starts_at: ISODateTime;
  location: string;
  /** Guests are counted, not named. */
  guest_count: number;
  closed: boolean;
  created_at: ISODateTime;
}

export type SyncState = "synced" | "pending" | "error";

export interface AttendanceRecord {
  id: UUID;
  church_id: UUID;
  service_id: UUID;
  member_id: UUID;
  checked_in_at: ISODateTime;
  sync_state: SyncState;
  sync_error: string | null;
  device: string;
  created_at: ISODateTime;
}

export type GivingType = "tithe" | "offering" | "thanksgiving" | "building_fund" | "pledge_payment";
export const GIVING_TYPES: readonly GivingType[] = [
  "tithe",
  "offering",
  "thanksgiving",
  "building_fund",
  "pledge_payment",
] as const;

/**
 * Append-only ledger row. A posted row is never edited or deleted;
 * a correction is a separate `reversal` row pointing at the original.
 */
export interface GivingEntry {
  id: UUID;
  church_id: UUID;
  ref: string; // GV-0391 or REV-0012
  kind: "posted" | "reversal";
  service_id: UUID | null;
  member_id: UUID | null;
  /** Shown when there is no member: "Anonymous" or "Loose offering count". */
  giver_label: string | null;
  type: GivingType;
  currency: Currency;
  /** Always positive. Reversals subtract by kind, not by sign. */
  amount_minor: number;
  reverses_id: UUID | null;
  reason: string | null;
  actor_name: string;
  created_at: ISODateTime;
}

/** Offline captures. Never counted in posted totals until a treasurer posts them. */
export interface GivingDraft {
  id: UUID;
  church_id: UUID;
  ref: string;
  service_id: UUID | null;
  member_id: UUID | null;
  giver_label: string | null;
  type: GivingType;
  currency: Currency;
  amount_minor: number;
  device: string;
  captured_by: string;
  status: "pending_review" | "posted" | "discarded";
  sync_state: SyncState;
  created_at: ISODateTime;
}

export interface GivingDayClose {
  id: UUID;
  church_id: UUID;
  day: ISODate;
  closed_by: string;
  created_at: ISODateTime;
}

export type ProspectStage = "new_contact" | "contacted" | "visiting" | "ready_to_join" | "converted";

export interface Prospect {
  id: UUID;
  church_id: UUID;
  first_name: string;
  last_name: string;
  phone: string | null;
  stage: ProspectStage;
  assignee_name: string;
  source: string;
  first_contact_on: ISODate;
  next_follow_up_on: ISODate | null;
  converted_member_id: UUID | null;
  created_at: ISODateTime;
}

export interface FollowUpEvent {
  id: UUID;
  church_id: UUID;
  prospect_id: UUID | null;
  member_id: UUID | null;
  note: string;
  author_name: string;
  created_at: ISODateTime;
}

/** Pastoral follow-up tasks shown on the dashboard. */
export interface FollowUpTask {
  id: UUID;
  church_id: UUID;
  subject: "prospect" | "member";
  prospect_id: UUID | null;
  member_id: UUID | null;
  context: string;
  assignee_name: string;
  due_on: ISODate;
  done_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface ChurchEvent {
  id: UUID;
  church_id: UUID;
  title: string;
  starts_at: ISODateTime;
  ends_at: ISODateTime | null;
  location: string;
  description: string;
  department_id: UUID | null;
  service_id: UUID | null;
  reminder_planned: boolean;
  created_at: ISODateTime;
}

export type MessageStatus = "queued" | "sending" | "sent" | "delivered";

export interface Message {
  id: UUID;
  church_id: UUID;
  body: string;
  audience_label: string;
  recipient_count: number;
  excluded_opt_out: number;
  segments: number;
  credits: number;
  delivered: number;
  failed: number;
  status: MessageStatus;
  sent_by: string;
  created_at: ISODateTime;
}

export interface SmsWalletEntry {
  id: UUID;
  church_id: UUID;
  kind: "credit" | "capture" | "release";
  credits: number;
  note: string;
  created_at: ISODateTime;
}

export interface SupportGrant {
  id: UUID;
  church_id: UUID;
  operator_name: string;
  reason: string;
  status: "requested" | "approved" | "denied" | "ended";
  approved_by: string | null;
  expires_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface AuditEvent {
  id: UUID;
  church_id: UUID | null;
  actor_name: string;
  action: string;
  created_at: ISODateTime;
}
