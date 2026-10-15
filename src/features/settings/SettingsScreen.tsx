"use client";

import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Building2, KeyRound, Minus, Plus, ShieldCheck, ShieldQuestion, UserPlus } from "lucide-react";
import {
  cancelInvite,
  churchSupportGrants,
  decideSupportRequest,
  inviteStaff,
  isGrantLive,
  listDepartments,
  listStaff,
  previewStatusCounts,
  revokeSupportGrant,
  ROLE_NAME,
  senderId,
  THRESHOLD_LIMITS,
  updateChurchProfile,
  updateChurchSettings,
  useDb,
  VISIBILITY_LABEL,
} from "@/data/repo";
import type { ChurchRole, PastorGivingVisibility, StaffUser } from "@/data/types";
import { fmtDate, fmtTime } from "@/lib/dates";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { ROLES } from "@/lib/roles";
import { STATUS_LABEL, type MemberStatus } from "@/lib/status";
import { formatCountdown, useNow } from "@/lib/useNow";
import { cn, initials } from "@/lib/cn";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";
import { fullVersionToast, toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";

type Tab = "profile" | "staff" | "status" | "giving" | "support";
const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Church profile" },
  { id: "staff", label: "Staff & roles" },
  { id: "status", label: "Member status" },
  { id: "giving", label: "Giving visibility" },
  { id: "support", label: "Support access" },
];

export function SettingsScreen() {
  const db = useDb();
  const { church, role, can } = useChurch();
  const params = useSearchParams();
  const wanted = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(wanted && TABS.some((t) => t.id === wanted) ? wanted : "profile");
  if (!can("settings")) {
    return (
      <NoAccess
        body={`${ROLES[role].label}: ${ROLES[role].limits}`}
        primary={{
          href: churchHref(church.slug, ""),
          label: "Back to dashboard",
        }}
      />
    );
  }
  const pending = churchSupportGrants(db, church.id).filter((g) => g.status === "requested").length;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted">{church.name}</p>
        <h1 className="mt-1 text-3xl font-extrabold">Settings &amp; roles</h1>
      </div>
      <Tabs
        label="Settings"
        items={TABS.map((t) => (t.id === "support" && pending ? { ...t, count: pending } : t))}
        value={tab}
        onChange={setTab}
        className="self-start max-w-full"
      />
      {tab === "profile" && <ProfileTab />}
      {tab === "staff" && <StaffTab />}
      {tab === "status" && <StatusTab />}
      {tab === "giving" && <GivingTab />}
      {tab === "support" && <SupportTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

const COUNTIES = [
  "Bomi",
  "Bong",
  "Gbarpolu",
  "Grand Bassa",
  "Grand Cape Mount",
  "Grand Gedeh",
  "Grand Kru",
  "Lofa",
  "Margibi",
  "Maryland",
  "Montserrado",
  "Nimba",
  "River Cess",
  "River Gee",
  "Sinoe",
];

function ProfileTab() {
  const { church, persona } = useChurch();
  const initial = {
    name: church.name,
    short_name: church.short_name,
    address: church.address ?? "",
    city: church.city,
    county: church.county,
    phone: church.phone ? formatPhone(church.phone) : "",
  };
  const [form, setForm] = useState(initial);
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k] !== initial[k]);
  const phone = form.phone.trim() ? normalizePhone(form.phone) : null;
  const errors = {
    name: form.name.trim() ? null : "Enter the church's full name.",
    short_name: !form.short_name.trim() ? "Enter a short name." : form.short_name.trim().length > 24 ? "Keep it to 24 characters or fewer." : null,
    city: form.city.trim() ? null : "Enter the town or city.",
    phone: phone && !phone.ok ? phone.error : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  const save = () => {
    setTried(true);
    if (invalid) return;
    updateChurchProfile(church, { ...form, phone: phone?.e164 ?? null }, persona.display);
    setTried(false);
    toast("Church profile saved", {
      body: "The new details show across the app and on printed reports.",
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="p-5">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Church name" error={tried ? errors.name : null} className="sm:col-span-2">
            {(p) => <Input {...p} value={form.name} onChange={set("name")} />}
          </Field>
          <Field label="Short name" hint="Used in the header, SMS and on small screens." error={tried ? errors.short_name : null}>
            {(p) => <Input {...p} value={form.short_name} onChange={set("short_name")} maxLength={32} />}
          </Field>
          <Field label="Office phone" error={tried ? errors.phone : null} hint="Optional. 077, 088 or 055 numbers.">
            {(p) => <Input {...p} type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="0770 200 450" />}
          </Field>
          <Field label="Address" className="sm:col-span-2">
            {(p) => <Input {...p} value={form.address} onChange={set("address")} placeholder="Street or landmark" />}
          </Field>
          <Field label="Town or city" error={tried ? errors.city : null}>
            {(p) => <Input {...p} value={form.city} onChange={set("city")} />}
          </Field>
          <Field label="County">
            {(p) => (
              <Select {...p} value={form.county} onChange={set("county")}>
                {COUNTIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <Button variant="secondary" disabled={!dirty} onClick={() => setForm(initial)}>
              Discard changes
            </Button>
            <Button type="submit" disabled={!dirty}>
              Save profile
            </Button>
          </div>
        </form>
      </Card>
      <Card className="self-start p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-navy-50 text-navy">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-navy">Managed by ComNet</p>
            <p className="text-sm text-muted">Set when the church was registered</p>
          </div>
        </div>
        <dl className="mt-4 flex flex-col gap-3 text-sm">
          <InfoRow label="SMS sender ID" value={<span className="font-mono">{senderId(church.name)}</span>} />
          <InfoRow label="Plan" value={church.plan} />
          <InfoRow label="Renews" value={church.renewal_on ? fmtDate(church.renewal_on) : "Not set"} />
          <InfoRow label="Hosting" value={`USD ${(church.hosting_fee_minor / 100).toFixed(0)} a year`} />
        </dl>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-line pt-3 first:border-0 first:pt-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold text-navy">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

const ROLE_TONE: Record<ChurchRole, BadgeTone> = {
  pastor: "navy",
  secretary: "active",
  treasurer: "new",
  dept_head: "neutral",
};

function StaffTab() {
  const db = useDb();
  const { church, persona } = useChurch();
  const [inviteOpen, setInviteOpen] = useState(false);
  const staff = listStaff(db, church.id);
  const deptName = (s: StaffUser) => (s.department_id ? db.departments.find((d) => d.id === s.department_id)?.name : null);
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Staff users"
          subtitle="Each person signs in with their own account. What they see follows their role."
          action={
            <Button icon={<UserPlus className="size-4" aria-hidden />} onClick={() => setInviteOpen(true)}>
              Invite user
            </Button>
          }
        />
        <div className="mt-4">
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH className="hidden md:table-cell">Phone</TH>
                <TH className="hidden sm:table-cell">Sign-in</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <tbody>
              {staff.map((s) => {
                const you = s.display_name === persona.display;
                return (
                  <TR key={s.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar initials={initials(s.display_name)} size="sm" tone={s.status === "invited" ? "neutral" : "navy"} />
                        <div className="min-w-0">
                          <p className="whitespace-nowrap font-semibold text-navy">
                            {s.display_name}
                            {you && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
                          </p>
                          <p className="text-xs text-muted sm:hidden">
                            {s.status === "invited" ? "Invite sent" : s.mfa ? "Two-step sign-in on" : "Password sign-in"}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex flex-col items-start gap-0.5">
                        <Badge tone={ROLE_TONE[s.role]}>{ROLE_NAME[s.role]}</Badge>
                        {deptName(s) && <span className="whitespace-nowrap text-[11px] text-muted">{deptName(s)}</span>}
                      </div>
                    </TD>
                    <TD className="tabular hidden whitespace-nowrap text-muted md:table-cell">{s.phone ? formatPhone(s.phone) : "Not set"}</TD>
                    <TD className="hidden sm:table-cell">
                      {s.status === "invited" ? (
                        <Badge tone="new">Invite sent {fmtDate(s.created_at, "d MMM")}</Badge>
                      ) : s.mfa ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-teal-ink">
                          <ShieldCheck className="size-4" aria-hidden /> Two-step on
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted">
                          <KeyRound className="size-4" aria-hidden /> Password
                        </span>
                      )}
                    </TD>
                    <TD className="text-right">
                      {s.status === "invited" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            cancelInvite(s, church, persona.display);
                            toast("Invitation cancelled", {
                              body: `${s.name} can no longer use the sign-in link.`,
                            });
                          }}
                        >
                          Cancel invite
                        </Button>
                      ) : you ? null : (
                        <Button variant="ghost" size="sm" onClick={() => fullVersionToast("Changing a staff member's role")}>
                          Change role
                        </Button>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardHeader title="What each role can do" subtitle="Enforced on the server in the full version, not just hidden in the app." />
        <ul className="grid gap-3 p-5 sm:grid-cols-2">
          {(["pastor", "secretary", "treasurer", "dept_head"] as const).map((r) => (
            <li key={r} className="rounded-xl border border-line p-4">
              <Badge tone={ROLE_TONE[r]}>{ROLE_NAME[r]}</Badge>
              <p className="mt-2 text-sm text-ink">
                {r === "dept_head" ? "Scoped to one department. Other members and all giving are hidden." : ROLES[r].limits}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const db = useDb();
  const { church, persona } = useChurch();
  const departments = listDepartments(db, church.id);
  const [name, setName] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [role, setRole] = useState<ChurchRole>("secretary");
  const [deptId, setDeptId] = useState(departments[0]?.id ?? "");
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const phone = normalizePhone(phoneRaw);
  const nameError = name.trim().split(/\s+/).length < 2 ? "Enter a first and last name." : null;
  const phoneError = phoneRaw.trim() ? (phone.ok ? serverError : phone.error) : "Enter their phone number. The invite goes by SMS.";

  const submit = () => {
    setTried(true);
    if (nameError || !phone.ok) return;
    const r = inviteStaff({
      church,
      name,
      phone: phone.e164!,
      role,
      departmentId: role === "dept_head" ? deptId : null,
      invitedBy: persona.display,
    });
    if (!r.ok) return setServerError(r.error);
    toast("Invitation sent", {
      body: `${r.staff.name} gets an SMS at ${formatPhone(r.staff.phone)} with a one-time sign-in link.`,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite a staff user"
      description="They get an SMS with a one-time link to set up their account."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form">
            Send invitation
          </Button>
        </>
      }
    >
      <form
        id="invite-form"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Full name" error={tried ? nameError : null}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Comfort Gbessay" />}
        </Field>
        <Field
          label="Phone number"
          error={tried ? phoneError : null}
          hint={phone.ok ? `Will be saved as ${formatPhone(phone.e164)}` : "077, 088 or 055 numbers"}
        >
          {(p) => (
            <Input
              {...p}
              type="tel"
              inputMode="tel"
              value={phoneRaw}
              onChange={(e) => {
                setPhoneRaw(e.target.value);
                setServerError(null);
              }}
              placeholder="0886 123 456"
            />
          )}
        </Field>
        <Field label="Role" hint={ROLES[role].limits}>
          {(p) => (
            <Select {...p} value={role} onChange={(e) => setRole(e.target.value as ChurchRole)}>
              {(["secretary", "treasurer", "dept_head", "pastor"] as const).map((r) => (
                <option key={r} value={r}>
                  {r === "pastor" ? "Pastor (associate)" : ROLE_NAME[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {role === "dept_head" && (
          <Field label="Department" hint="Department heads only see this department's members.">
            {(p) => (
              <Select {...p} value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Member status thresholds                                            */
/* ------------------------------------------------------------------ */

const STATUS_ORDER: MemberStatus[] = ["active", "new", "inactive", "excused"];

function StatusTab() {
  const db = useDb();
  const { church, persona } = useChurch();
  const saved = church.settings;
  const [newDays, setNewDays] = useState(saved.new_days);
  const [weeks, setWeeks] = useState(saved.inactive_weeks);
  const current = previewStatusCounts(db, church.id, saved);
  const preview = previewStatusCounts(db, church.id, {
    ...saved,
    new_days: newDays,
    inactive_weeks: weeks,
  });
  const dirty = newDays !== saved.new_days || weeks !== saved.inactive_weeks;
  const isDefault = newDays === THRESHOLD_LIMITS.new_days.default && weeks === THRESHOLD_LIMITS.inactive_weeks.default;

  const save = () => {
    updateChurchSettings(church, { new_days: newDays, inactive_weeks: weeks }, persona.display);
    toast("Statuses recalculated", {
      body: `${preview.inactive} inactive and ${preview.new} new members now, everywhere in the app.`,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="p-5">
        <h2 className="text-[17px] font-bold">When does a member&apos;s status change?</h2>
        <p className="mt-1 text-sm text-muted">Status is worked out from attendance every time it is shown. It is never typed in by hand.</p>
        <div className="mt-5 flex flex-col gap-5">
          <Stepper
            label="New member period"
            unit="days"
            value={newDays}
            onChange={setNewDays}
            {...THRESHOLD_LIMITS.new_days}
            step={7}
            help="Members are New for this long after joining, whatever their attendance."
          />
          <Stepper
            label="Inactive after"
            unit="weeks"
            value={weeks}
            onChange={setWeeks}
            {...THRESHOLD_LIMITS.inactive_weeks}
            step={1}
            help="Members with no attendance for this long become Inactive and appear in follow-up lists."
          />
        </div>
        <ul className="mt-5 flex flex-col gap-1.5 rounded-xl bg-cloud p-4 text-sm text-ink">
          <li>Members with an approved exception (homebound, leave) are Excused and never marked inactive.</li>
          <li>Imported members stay New until their first check-in, so an import never marks people inactive.</li>
          <li>If no services were recorded in the window, nobody is marked inactive.</li>
        </ul>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {!isDefault && (
            <Button
              variant="ghost"
              onClick={() => {
                setNewDays(THRESHOLD_LIMITS.new_days.default);
                setWeeks(THRESHOLD_LIMITS.inactive_weeks.default);
              }}
            >
              Use defaults (28 days, 6 weeks)
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={!dirty}
            onClick={() => {
              setNewDays(saved.new_days);
              setWeeks(saved.inactive_weeks);
            }}
          >
            Discard
          </Button>
          <Button disabled={!dirty} onClick={save}>
            Save and recalculate
          </Button>
        </div>
      </Card>

      <Card className="self-start p-5" aria-live="polite">
        <h2 className="text-[17px] font-bold">{dirty ? "Preview" : "Members today"}</h2>
        <p className="mt-1 text-sm text-muted">
          {dirty
            ? "What the whole church would look like after saving."
            : `With New for ${saved.new_days} days and inactive after ${saved.inactive_weeks} weeks.`}
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {STATUS_ORDER.map((s) => {
            const diff = preview[s] - current[s];
            return (
              <li key={s} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                <Badge tone={s}>{STATUS_LABEL[s]}</Badge>
                <span className="flex items-baseline gap-2">
                  {dirty && diff !== 0 && (
                    <span className={cn("tabular text-xs font-semibold", diff > 0 === (s === "inactive") ? "text-danger-ink" : "text-teal-ink")}>
                      {diff > 0 ? "+" : "−"}
                      {Math.abs(diff)}
                    </span>
                  )}
                  <span className="tabular font-heading text-xl font-extrabold text-navy">{preview[s].toLocaleString("en-US")}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Stepper({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step,
  help,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  help: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <Field label={label} hint={`${help} Between ${min} and ${max} ${unit}.`}>
      {(p) => (
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="w-11 px-0" aria-label={`Fewer ${unit}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
            <Minus className="size-4" aria-hidden />
          </Button>
          <div className="w-20 shrink-0">
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              value={value}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && e.target.value !== "") onChange(clamp(Math.round(n)));
              }}
              className="tabular text-center"
            />
          </div>
          <Button variant="secondary" className="w-11 px-0" aria-label={`More ${unit}`} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>
            <Plus className="size-4" aria-hidden />
          </Button>
          <span className="text-sm text-muted">{unit}</span>
        </div>
      )}
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Pastor giving visibility                                            */
/* ------------------------------------------------------------------ */

const VISIBILITY_HELP: Record<PastorGivingVisibility, string> = {
  none: "Giving is hidden from the pastor everywhere: no Giving screen, no totals on the dashboard, no giving reports.",
  totals: "The pastor sees totals per currency and per giving type, but not who gave what. This is the default.",
  ledger: "The pastor sees the full ledger, including each giver's name and amount, the same as the treasurer.",
};

function GivingTab() {
  const { church, persona } = useChurch();
  const [value, setValue] = useState<PastorGivingVisibility>(church.settings.pastor_giving_visibility);
  const dirty = value !== church.settings.pastor_giving_visibility;
  return (
    <Card className="max-w-3xl p-5">
      <h2 className="text-[17px] font-bold">What the pastor sees of giving</h2>
      <p className="mt-1 text-sm text-muted">The treasurer always sees the full ledger. Members&apos; individual giving stays private unless this allows it.</p>
      <fieldset className="mt-4">
        <legend className="sr-only">Pastor giving visibility</legend>
        <div className="flex flex-col gap-2">
          {(["none", "totals", "ledger"] as const).map((v) => (
            <label
              key={v}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                value === v ? "border-navy bg-navy-50" : "border-line hover:border-navy-200",
              )}
            >
              <input type="radio" name="visibility" value={v} checked={value === v} onChange={() => setValue(v)} className="mt-1 size-5 shrink-0 accent-navy" />
              <span>
                <span className="font-semibold text-navy">{VISIBILITY_LABEL[v]}</span>
                {v === "totals" && <span className="ml-2 text-xs text-muted">Default</span>}
                <span className="mt-0.5 block text-sm text-muted">{VISIBILITY_HELP[v]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={!dirty} onClick={() => setValue(church.settings.pastor_giving_visibility)}>
          Discard
        </Button>
        <Button
          disabled={!dirty}
          onClick={() => {
            updateChurchSettings(church, { pastor_giving_visibility: value }, persona.display);
            toast("Giving visibility saved", {
              body:
                value === "none"
                  ? "Giving is now hidden from the pastor's menu and dashboard."
                  : value === "ledger"
                    ? "Open Giving to see the full ledger."
                    : "The pastor sees totals only.",
            });
          }}
        >
          Save
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Support access                                                      */
/* ------------------------------------------------------------------ */

function SupportTab() {
  const db = useDb();
  const now = useNow();
  const { church, persona } = useChurch();
  const [hours, setHours] = useState(2);
  const grants = churchSupportGrants(db, church.id);
  const requested = grants.filter((g) => g.status === "requested");
  const live = grants.filter((g) => isGrantLive(g, now));
  const history = grants.filter((g) => g.status !== "requested" && !isGrantLive(g, now));
  const approver = `${persona.display} (Pastor)`;

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex items-start gap-3 p-5">
        <ShieldCheck className="mt-0.5 size-6 shrink-0 text-teal" aria-hidden />
        <div>
          <h2 className="text-[17px] font-bold">ComNet only sees your records with your approval</h2>
          <p className="mt-1 text-sm text-muted">
            Support access is read-only, ends automatically and never includes giving. Every request, approval and visit is logged.
          </p>
        </div>
      </Card>

      {requested.map((g) => (
        <section
          key={g.id}
          aria-label="Support request"
          className="flex flex-col gap-4 rounded-2xl border border-gold bg-gold-soft p-5 md:flex-row md:items-center"
        >
          <ShieldQuestion className="size-6 shrink-0 text-gold-ink" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-navy">{g.operator_name} from ComNet asked for access</p>
            <p className="mt-0.5 text-sm text-ink">
              {fmtDate(g.created_at, "d MMM")} at {fmtTime(g.created_at)}: &ldquo;{g.reason}&rdquo;
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Access lasts" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-36">
              <option value={1}>For 1 hour</option>
              <option value={2}>For 2 hours</option>
              <option value={4}>For 4 hours</option>
            </Select>
            <Button
              variant="secondary"
              onClick={() => {
                decideSupportRequest(g.id, church, false, approver);
                toast("Support request denied", {
                  body: "ComNet has been told. Nothing was shared.",
                });
              }}
            >
              Deny
            </Button>
            <Button
              onClick={() => {
                decideSupportRequest(g.id, church, true, approver, hours);
                toast("Support access approved", {
                  body: `Read-only access to members and attendance for ${hours === 1 ? "1 hour" : `${hours} hours`}.`,
                });
              }}
            >
              Approve
            </Button>
          </div>
        </section>
      ))}

      {live.map((g) => (
        <Card key={g.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="active">Active</Badge>
              <p className="font-semibold text-navy">
                {g.operator_name} · {g.reason}
              </p>
            </div>
            <p className="mt-1 text-sm text-muted">
              Approved by {g.approved_by ?? "the church"} · ends in{" "}
              <span className="tabular font-semibold text-navy">{formatCountdown(new Date(g.expires_at!).getTime() - now.getTime())}</span>
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              revokeSupportGrant(g.id, church, approver);
              toast("Support access ended", {
                body: "ComNet can no longer open your records.",
              });
            }}
          >
            End access now
          </Button>
        </Card>
      ))}

      <Card>
        <CardHeader title="History" />
        {history.length === 0 && requested.length === 0 && live.length === 0 ? (
          <EmptyState title="No support requests yet" body="When ComNet asks for access, the request appears here and on your dashboard." />
        ) : history.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-sm text-muted">Nothing earlier.</p>
        ) : (
          <ul className="flex flex-col px-5 pb-3 pt-2">
            {history.map((g) => (
              <li key={g.id} className="flex flex-col gap-1 border-t border-line py-3 first:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{g.reason}</p>
                  <p className="text-sm text-muted">
                    {g.operator_name} · asked {fmtDate(g.created_at, "d MMM")}
                    {g.approved_by && ` · ${g.status === "denied" ? "denied" : "approved"} by ${g.approved_by}`}
                  </p>
                </div>
                <Badge tone={g.status === "denied" ? "inactive" : "excused"}>
                  {g.status === "denied" ? "Denied" : g.expires_at ? `Ended ${fmtDate(g.expires_at, "d MMM, h:mm a")}` : "Ended"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
