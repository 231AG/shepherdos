"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  churchMemberCount,
  endSupportGrant,
  isGrantLive,
  listAuditEvents,
  listPlatformChurches,
  listSupportGrants,
  provisionChurch,
  requestSupportAccess,
  smsBalance,
  startSupportSession,
  useDb,
  type Db,
} from "@/data/repo";
import type { Church, SubscriptionStatus } from "@/data/types";
import { useDemoStore } from "@/data/store";
import { DEFAULT_CHURCH_SLUG } from "@/data/constants";
import { Logo } from "@/components/brand/Logo";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal, Sheet } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Avatar, Skeleton } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";
import { toast, Toaster } from "@/components/ui/Toast";
import { DemoBar } from "@/components/shell/DemoBar";
import { NoAccess } from "@/components/shell/NoAccess";
import { useGuideMark, useHydrated } from "@/components/shell/hooks";
import { cn } from "@/lib/cn";
import { fmtDate, fmtTime } from "@/lib/dates";
import { formatCountdown, useNow } from "@/lib/useNow";
import { normalizePhone } from "@/lib/phone";
import { isToday } from "date-fns";

const STATUS: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "active" },
  renewal_due: { label: "Renewal due", tone: "new" },
  overdue_read_only: { label: "Overdue · read-only", tone: "inactive" },
  onboarding: { label: "Onboarding", tone: "excused" },
};

type Tab = "churches" | "subscriptions" | "sms" | "audit";
const TABS: { id: Tab; label: string }[] = [
  { id: "churches", label: "Churches" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "sms", label: "SMS credits" },
  { id: "audit", label: "Audit log" },
];

const COUNTIES = ["Bomi", "Bong", "Gbarpolu", "Grand Bassa", "Grand Cape Mount", "Grand Gedeh", "Grand Kru", "Lofa", "Margibi", "Maryland", "Montserrado", "Nimba", "River Cess", "River Gee", "Sinoe"];

function renewalText(c: Church): string {
  if (c.subscription_status === "onboarding") return "Starts on go-live";
  if (!c.renewal_on) return "Not set";
  if (c.subscription_status === "overdue_read_only") return `Lapsed ${fmtDate(c.renewal_on)}`;
  return fmtDate(c.renewal_on);
}

export function PlatformApp() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="min-h-dvh" aria-busy="true">
        <div className="h-11 bg-navy-950" />
        <div className="h-16 bg-navy" />
        <div className="mx-auto max-w-6xl p-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="mt-6 h-96" />
        </div>
      </div>
    );
  }
  return <PlatformHydrated />;
}

function PlatformHydrated() {
  const role = useDemoStore((s) => s.role);
  const [tab, setTab] = useState<Tab>("churches");
  const mark = useGuideMark();
  useEffect(() => {
    if (role === "operator") mark("view_platform");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (role !== "operator") {
    return (
      <div className="min-h-dvh">
        <DemoBar churchSlug={null} />
        <main className="px-4">
          <NoAccess
            body="The Platform console is for ComNet operators only. Church staff manage their own church from the church dashboard."
            primary={{ href: `/c/${DEFAULT_CHURCH_SLUG}/`, label: "Go to church dashboard" }}
          />
        </main>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <DemoBar churchSlug={null} />
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Logo tone="onDark" subtitle="Operator console · ComNet IT Solutions" />
          <nav aria-label="Platform sections" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "h-11 shrink-0 rounded-xl px-3 text-sm font-semibold md:h-9",
                  tab === t.id ? "bg-navy-700 text-white" : "text-navy-100 hover:bg-navy-700 hover:text-white",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <Avatar initials="AS" tone="teal" size="sm" />
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-semibold">Aaron Sumo</span>
              <span className="text-xs text-navy-200">Platform operator</span>
            </span>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
        {tab === "churches" && <ChurchesTab />}
        {tab === "subscriptions" && <SubscriptionsTab />}
        {tab === "sms" && <SmsTab />}
        {tab === "audit" && <AuditTab />}
      </main>
      <Toaster />
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string | number; note: string; tone?: "gold" }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={cn("mt-1.5 font-heading text-[28px] font-extrabold leading-none", tone === "gold" ? "text-gold-ink" : "text-navy")}>{value}</p>
      <p className="mt-2 text-xs text-muted">{note}</p>
    </div>
  );
}

function ChurchesTab() {
  const db = useDb();
  const now = useNow(1000);
  const churches = listPlatformChurches(db);
  const grants = listSupportGrants(db).filter((g) => isGrantLive(g, now));
  const renewals = churches.filter((c) => c.subscription_status === "renewal_due" || c.subscription_status === "overdue_read_only").length;
  const overdue = churches.filter((c) => c.subscription_status === "overdue_read_only").length;
  const pilots = churches.filter((c) => c.plan === "Pilot · annual").length;
  const onboarding = churches.filter((c) => c.subscription_status === "onboarding").length;
  const [manage, setManage] = useState<Church | null>(null);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const firstExpiry = grants[0]?.expires_at ? formatCountdown(new Date(grants[0].expires_at).getTime() - now.getTime()) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Churches</h1>
          <p className="mt-1 text-sm text-muted">Subscription and usage metadata only. Church records open only through an audited support grant.</p>
        </div>
        <Button onClick={() => setProvisionOpen(true)} icon={<Plus className="size-4" aria-hidden />} className="shrink-0">
          Provision church
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Churches" value={churches.length} note={`${pilots} pilots · ${onboarding} onboarding`} />
        <Kpi label="Annual hosting" value="USD 850" note="Per church, per year" />
        <Kpi label="Renewals in 60 days" value={renewals} note={`${overdue} overdue · read-only grace`} tone="gold" />
        <Kpi label="Active support grants" value={grants.length} note={firstExpiry ? `Expires in ${firstExpiry}` : "None open"} />
      </div>

      <Card>
        <CardHeader title="All churches" />
        <div className="mt-4">
          <Table>
            <caption className="sr-only">All churches on the platform</caption>
            <THead>
              <tr>
                <TH scope="col">Church</TH>
                <TH scope="col">Plan</TH>
                <TH scope="col">Renewal</TH>
                <TH scope="col" className="text-right">Staff</TH>
                <TH scope="col" className="text-right">Members</TH>
                <TH scope="col" className="text-right">SMS credits</TH>
                <TH scope="col">Status</TH>
                <TH scope="col"><span className="sr-only">Actions</span></TH>
              </tr>
            </THead>
            <tbody>
              {churches.map((c) => {
                const members = churchMemberCount(db, c);
                const credits = smsBalance(db, c);
                return (
                  <TR key={c.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar initials={c.initials} size="sm" className="rounded-lg" />
                        <div className="min-w-0">
                          <p className="whitespace-nowrap font-semibold text-navy">{c.name}</p>
                          <p className="text-xs text-muted">{c.city}, {c.county}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap text-ink">{c.plan}</TD>
                    <TD className="whitespace-nowrap text-ink">{renewalText(c)}</TD>
                    <TD className="tabular text-right">{c.staff_count}</TD>
                    <TD className="tabular whitespace-nowrap text-right">{members === null ? <span className="text-muted">Import pending</span> : members.toLocaleString("en-US")}</TD>
                    <TD className={cn("tabular whitespace-nowrap text-right font-semibold", credits < 200 ? "text-danger-ink" : "text-navy")}>
                      {credits.toLocaleString("en-US")}
                      {credits > 0 && credits < 200 ? " · low" : ""}
                    </TD>
                    <TD>
                      <Badge tone={STATUS[c.subscription_status].tone}>{STATUS[c.subscription_status].label}</Badge>
                    </TD>
                    <TD className="text-right">
                      <Button variant="secondary" size="sm" onClick={() => setManage(c)} aria-label={`Manage ${c.name}`}>
                        Manage
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <SupportAccessCard db={db} now={now} />
        <AuditCard db={db} limit={5} />
      </div>

      <ManageSheet church={manage} onClose={() => setManage(null)} db={db} />
      <ProvisionModal open={provisionOpen} onClose={() => setProvisionOpen(false)} />
    </div>
  );
}

function SupportAccessCard({ db, now }: { db: Db; now: Date }) {
  const router = useRouter();
  const mark = useGuideMark();
  const grants = listSupportGrants(db);
  const live = grants.filter((g) => isGrantLive(g, now));
  const requested = grants.filter((g) => g.status === "requested");
  const requestable = listPlatformChurches(db).filter(
    (c) => c.has_content && !live.some((g) => g.church_id === c.id) && !requested.some((g) => g.church_id === c.id),
  );
  const [churchId, setChurchId] = useState("");
  const [reason, setReason] = useState("Import troubleshooting");
  const target = requestable.find((c) => c.id === churchId) ?? requestable[0];
  return (
    <Card>
      <CardHeader title="Support access" />
      <div className="flex flex-col gap-3 px-5 pb-5 pt-4">
        {live.length === 0 && requested.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">No open support grants.</p>
        )}
        {live.map((g) => {
          const church = db.churches.find((c) => c.id === g.church_id)!;
          return (
            <div key={g.id} className="flex flex-col gap-3 rounded-xl border border-teal/40 bg-teal-soft/60 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy">{church.name}</p>
                <p className="mt-0.5 text-xs text-ink">
                  Granted by {g.approved_by} to A. Sumo · read-only · reason: {g.reason.toLowerCase()}
                </p>
                <p className="tabular mt-1 text-xs font-semibold text-teal-ink" aria-live="off">
                  Expires in {formatCountdown(new Date(g.expires_at!).getTime() - now.getTime())}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    startSupportSession(g.id, church);
                    mark("open_support");
                    router.push(`/c/${church.slug}/`);
                  }}
                >
                  Open church
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-danger-ink"
                  onClick={() => {
                    endSupportGrant(g.id, church.name);
                    toast("Support access ended", { body: `${church.name} can no longer be opened by ComNet.` });
                  }}
                >
                  End now
                </Button>
              </div>
            </div>
          );
        })}
        {requested.map((g) => {
          const church = db.churches.find((c) => c.id === g.church_id)!;
          return (
            <div key={g.id} className="rounded-xl border border-gold/70 bg-gold-soft p-4">
              <p className="font-semibold text-navy">{church.name}</p>
              <p className="mt-0.5 text-xs text-gold-ink">
                Requested {fmtTime(g.created_at)} · {g.reason} · waiting for the church admin to approve
              </p>
            </div>
          );
        })}
        {target && (
          <form
            className="flex flex-col gap-2 rounded-xl bg-cloud p-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              requestSupportAccess(target, reason);
              mark("request_access");
              toast("Access requested", { body: `${target.short_name}'s pastor will see the request on their dashboard.` });
            }}
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="grant-church" className="text-xs font-semibold text-navy">
                Request access to
              </label>
              <Select id="grant-church" value={target.id} onChange={(e) => setChurchId(e.target.value)}>
                {requestable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="grant-reason" className="text-xs font-semibold text-navy">
                Reason
              </label>
              <Select id="grant-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {["Import troubleshooting", "Check-in sync problem", "Account setup help", "SMS delivery question"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary" className="shrink-0">
              Request
            </Button>
          </form>
        )}
        <p className="text-xs text-muted">
          Grants are requested by the operator, approved by a church admin, time-limited, and every action taken under them is written to the church&apos;s audit log.
          Giving is never visible to ComNet.
        </p>
      </div>
    </Card>
  );
}

function auditTime(iso: string): string {
  return isToday(new Date(iso)) ? `Today ${fmtTime(iso)}` : fmtDate(iso, "d MMM");
}

function AuditCard({ db, limit }: { db: Db; limit?: number }) {
  const events = listAuditEvents(db).slice(0, limit);
  return (
    <Card>
      <CardHeader title="Recent privileged actions" />
      <ul className="px-5 pb-4 pt-3">
        {events.map((e) => (
          <li key={e.id} className="flex gap-4 border-b border-line py-3 last:border-b-0">
            <span className="w-20 shrink-0 text-xs text-muted">{auditTime(e.created_at)}</span>
            <span className="text-sm text-ink">{e.action}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ManageSheet({ church, onClose, db }: { church: Church | null; onClose: () => void; db: Db }) {
  return (
    <Sheet open={!!church} onClose={onClose} title={church?.name ?? ""} description={church ? `${church.city}, ${church.county}` : undefined}>
      {church && (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Plan", church.plan],
            ["Status", STATUS[church.subscription_status].label],
            ["Renewal", renewalText(church)],
            ["Hosting", "USD 850.00 per year"],
            ["Staff accounts", String(church.staff_count)],
            ["Members", churchMemberCount(db, church)?.toLocaleString("en-US") ?? "Import pending"],
            ["SMS credits", smsBalance(db, church).toLocaleString("en-US")],
            ["Created", fmtDate(church.created_at)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-cloud p-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 font-semibold text-navy">{v}</dd>
            </div>
          ))}
          <p className="col-span-2 text-xs text-muted">
            Operators see subscription metadata only. Members, attendance and giving stay private to the church unless it approves a support grant.
          </p>
        </dl>
      )}
    </Sheet>
  );
}

function ProvisionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", city: "", county: "Montserrado", adminName: "", adminPhone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mark = useGuideMark();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = () => {
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 3) errs.name = "Enter the church's name.";
    if (!form.city.trim()) errs.city = "Enter the city or town.";
    if (!form.adminName.trim()) errs.adminName = "Who should receive the admin invite?";
    const phone = normalizePhone(form.adminPhone);
    if (!phone.ok) errs.adminPhone = phone.error ?? "Enter a valid phone number.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    provisionChurch({ ...form, name: form.name.trim(), city: form.city.trim(), adminPhone: phone.e164! });
    mark("provision_church");
    toast("Church provisioned", { body: `${form.name.trim()} is onboarding. An invite was sent to ${form.adminName.trim()} (simulated).` });
    setForm({ name: "", city: "", county: "Montserrado", adminName: "", adminPhone: "" });
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Provision a church"
      description="Creates the church space and sends its first admin an invite. Simulated in this demo."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Provision church</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Church name" error={errors.name}>{(p) => <Input {...p} value={form.name} onChange={set("name")} placeholder="e.g. Calvary Baptist Church" />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City or town" error={errors.city}>{(p) => <Input {...p} value={form.city} onChange={set("city")} placeholder="e.g. Kakata" />}</Field>
          <Field label="County">
            {(p) => (
              <Select {...p} value={form.county} onChange={set("county")}>
                {COUNTIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Church admin" error={errors.adminName}>{(p) => <Input {...p} value={form.adminName} onChange={set("adminName")} placeholder="Full name" />}</Field>
        <Field label="Admin phone" hint="077, 088 or 055 numbers. Saved as +231." error={errors.adminPhone}>
          {(p) => <Input {...p} inputMode="tel" value={form.adminPhone} onChange={set("adminPhone")} placeholder="0770 123 456" />}
        </Field>
      </div>
    </Modal>
  );
}

function SubscriptionsTab() {
  const db = useDb();
  const churches = listPlatformChurches(db);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted">Annual hosting is USD 850 per church. Billing is tracked here; payments are handled outside ShepherdOS.</p>
      </div>
      <Card>
        <Table>
          <caption className="sr-only">Subscriptions</caption>
          <THead>
            <tr>
              <TH scope="col">Church</TH>
              <TH scope="col">Plan</TH>
              <TH scope="col" className="text-right">Annual fee</TH>
              <TH scope="col">Renewal</TH>
              <TH scope="col">Status</TH>
            </tr>
          </THead>
          <tbody>
            {churches.map((c) => (
              <TR key={c.id}>
                <TD className="font-semibold text-navy">{c.name}</TD>
                <TD>{c.plan}</TD>
                <TD className="tabular whitespace-nowrap text-right">USD 850.00</TD>
                <TD className="whitespace-nowrap">{renewalText(c)}</TD>
                <TD><Badge tone={STATUS[c.subscription_status].tone}>{STATUS[c.subscription_status].label}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function SmsTab() {
  const db = useDb();
  const churches = listPlatformChurches(db);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold">SMS credits</h1>
        <p className="mt-1 text-sm text-muted">One credit sends one SMS segment to one member. Churches top up through ComNet.</p>
      </div>
      <Card>
        <Table>
          <caption className="sr-only">SMS credit balances</caption>
          <THead>
            <tr>
              <TH scope="col">Church</TH>
              <TH scope="col" className="text-right">Balance</TH>
              <TH scope="col"><span className="sr-only">Actions</span></TH>
            </tr>
          </THead>
          <tbody>
            {churches.map((c) => {
              const credits = smsBalance(db, c);
              return (
                <TR key={c.id}>
                  <TD className="font-semibold text-navy">{c.name}</TD>
                  <TD className={cn("tabular text-right font-semibold", credits < 200 ? "text-danger-ink" : "text-navy")}>{credits.toLocaleString("en-US")}</TD>
                  <TD className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => toast("Top-up recorded (simulated)", { tone: "info", body: `A top-up for ${c.name} would be added once ComNet confirms payment.` })}
                    >
                      Add credits
                    </Button>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function AuditTab() {
  const db = useDb();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold">Audit log</h1>
        <p className="mt-1 text-sm text-muted">Every privileged action by ComNet staff is recorded and cannot be edited.</p>
      </div>
      <AuditCard db={db} />
    </div>
  );
}
