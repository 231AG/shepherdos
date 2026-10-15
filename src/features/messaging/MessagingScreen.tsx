"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCheck, Loader2, Plus, RotateCw, Send, WifiOff, X } from "lucide-react";
import {
  listDepartments,
  listMembers,
  listMessages,
  matchesMemberQuery,
  resolveAudience,
  retryFailed,
  sendMessage,
  senderId,
  settleMessages,
  useDb,
  walletBalance,
  walletHistory,
  type Audience,
} from "@/data/repo";
import type { Member, Message } from "@/data/types";
import { useDemoStore } from "@/data/store";
import { countSms } from "@/lib/sms";
import { STATUS_LABEL, type MemberStatus } from "@/lib/status";
import { fmtDate, fmtTime } from "@/lib/dates";
import { cn, plural } from "@/lib/cn";
import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/misc";
import { Chips, Tabs } from "@/components/ui/Tabs";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";
import { fullVersionToast, toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";
import { useGuideMark } from "@/components/shell/hooks";

type Tab = "compose" | "history" | "credits";
type AudienceKind = Audience["kind"];

export function MessagingScreen() {
  const db = useDb();
  const { church, role, can } = useChurch();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("compose");
  useEffect(() => {
    settleMessages(church.id);
  }, [church.id]);
  if (!can("messaging")) {
    return <NoAccess body={`${ROLES[role].label}: ${ROLES[role].limits}`} primary={{ href: churchHref(church.slug, ""), label: "Back to dashboard" }} />;
  }
  const balance = walletBalance(db, church.id);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted">
          SMS to members · <span className="tabular font-semibold text-navy">{balance.toLocaleString("en-US")}</span> credits
        </p>
        <h1 className="mt-1 text-3xl font-extrabold">Messaging</h1>
      </div>
      <Tabs
        label="Messaging"
        value={tab}
        onChange={setTab}
        items={[
          { id: "compose", label: "New message" },
          { id: "history", label: "Sent", count: listMessages(db, church.id).length },
          { id: "credits", label: "Credits" },
        ]}
        className="self-start"
      />
      {tab === "compose" && <Composer initialBody={params.get("body") ?? ""} initialDept={params.get("dept")} onSent={() => setTab("history")} />}
      {tab === "history" && <History />}
      {tab === "credits" && <Credits />}
    </div>
  );
}

const TEMPLATES: { label: string; text: (church: string) => string }[] = [
  { label: "Service reminder", text: (c) => `${c}: Join us for Sunday worship at 9AM. Come early and bring a friend. God bless you.` },
  { label: "We missed you", text: (c) => `Dear member, we missed you at ${c}. We are praying for you and your family. Call the church office anytime.` },
  { label: "Prayer meeting", text: (c) => `${c}: Wednesday prayer meeting at 6PM in the fellowship hall. All are welcome.` },
];

function Composer({ initialBody, initialDept, onSent }: { initialBody: string; initialDept: string | null; onSent: () => void }) {
  const db = useDb();
  const { church, persona } = useChurch();
  const online = useDemoStore((s) => s.online);
  const mark = useGuideMark();
  const departments = listDepartments(db, church.id);
  const [kind, setKind] = useState<AudienceKind>(initialDept ? "department" : "all");
  const [deptId, setDeptId] = useState(initialDept ?? departments[0]?.id ?? "");
  const [status, setStatus] = useState<MemberStatus>("inactive");
  const [picked, setPicked] = useState<Member[]>([]);
  const [body, setBody] = useState(initialBody);
  const [confirming, setConfirming] = useState(false);

  const resolved = useMemo(() => {
    const audience: Audience =
      kind === "all" ? { kind } : kind === "department" ? { kind, departmentId: deptId } : kind === "status" ? { kind, status } : { kind, memberIds: picked.map((m) => m.id) };
    return resolveAudience(db, church.id, audience);
  }, [db, church.id, kind, deptId, status, picked]);
  const count = countSms(body);
  const credits = resolved.recipients.length * count.segments;
  const balance = walletBalance(db, church.id);
  const short = credits > balance;
  const sender = senderId(church.name);

  const problem = !online
    ? "You're offline. Messages need a connection to send."
    : !body.trim()
      ? "Write a message to send."
      : resolved.recipients.length === 0
        ? "No one in this audience can receive SMS."
        : short
          ? `Not enough credits: this needs ${credits.toLocaleString("en-US")} and the wallet has ${balance.toLocaleString("en-US")}. Top up through ComNet.`
          : null;

  const send = () => {
    const r = sendMessage({ churchId: church.id, body, audience: resolved, segments: count.segments, sentBy: persona.display });
    setConfirming(false);
    if (!r.ok) return toast("Not sent", { tone: "warning", body: r.error });
    mark("send_sms");
    toast("Message queued", { body: `Sending to ${plural(resolved.recipients.length, "member")}. ${plural(credits, "credit")} used. No real SMS is sent in the demo.` });
    setBody("");
    onSent();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
      <Card className="flex flex-col gap-5 p-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-navy" id="aud-label">
            Send to
          </p>
          <Chips
            label="Audience"
            value={kind}
            onChange={setKind}
            items={[
              { id: "all", label: "Everyone" },
              { id: "department", label: "A department" },
              { id: "status", label: "By status" },
              { id: "picked", label: "Choose members" },
            ]}
          />
          <div className="mt-3">
            {kind === "department" && (
              <Select aria-label="Department" value={deptId} onChange={(e) => setDeptId(e.target.value)} className="sm:max-w-xs">
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
            {kind === "status" && (
              <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as MemberStatus)} className="sm:max-w-xs">
                {(["active", "new", "inactive", "excused"] as MemberStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]} members
                  </option>
                ))}
              </Select>
            )}
            {kind === "picked" && <MultiPicker churchId={church.id} picked={picked} setPicked={setPicked} />}
          </div>
          <p className="mt-3 rounded-xl bg-cloud px-3 py-2.5 text-sm text-ink" aria-live="polite">
            <span className="font-semibold text-navy">{plural(resolved.recipients.length, "member")}</span> will receive it.{" "}
            {resolved.optedOut > 0 && <>{plural(resolved.optedOut, "opted-out member")} excluded automatically. </>}
            {resolved.noPhone > 0 && <>{resolved.noPhone} with no phone number.</>}
          </p>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="sms-body" className="text-sm font-semibold text-navy">
              Message
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button key={t.label} type="button" onClick={() => setBody(t.text(church.short_name))} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line-strong px-3 text-xs font-semibold text-navy hover:bg-navy-50">
                  <Plus className="size-3" aria-hidden /> {t.label}
                </button>
              ))}
            </div>
          </div>
          <Textarea id="sms-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} aria-describedby="sms-count" placeholder="Write your message. Keep it short: one SMS holds 160 characters." />
          <div id="sms-count" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm" aria-live="polite">
            <span className="tabular text-ink">
              <span className="font-semibold">{count.units}</span> characters · <span className="font-semibold">{count.segments || 0}</span> SMS
              {count.segments > 0 && ` · ${count.remaining} left in this SMS`}
            </span>
            <Badge tone={count.encoding === "GSM-7" ? "neutral" : "new"}>{count.encoding === "GSM-7" ? "Standard (160 per SMS)" : "Unicode (70 per SMS)"}</Badge>
          </div>
          {count.encoding === "Unicode" && (
            <p className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-gold-soft px-3 py-2 text-sm text-gold-ink">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                These characters make every SMS hold only 70 characters: <span className="font-semibold">{count.unicodeChars.join(" ")}</span>
              </span>
              <button
                type="button"
                className="font-semibold underline underline-offset-4"
                onClick={() => setBody((b) => b.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "..."))}
              >
                Replace quotes and dashes
              </button>
            </p>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <h2 className="text-[17px] font-bold">Cost</h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Recipients × SMS</dt>
              <dd className="tabular text-ink">
                {resolved.recipients.length} × {count.segments}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Credits needed</dt>
              <dd className={cn("tabular font-semibold", short ? "text-danger-ink" : "text-navy")}>{credits.toLocaleString("en-US")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Wallet balance</dt>
              <dd className="tabular text-ink">{balance.toLocaleString("en-US")}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="text-muted">After sending</dt>
              <dd className="tabular font-semibold text-navy">{short ? "Not enough" : (balance - credits).toLocaleString("en-US")}</dd>
            </div>
          </dl>
          {problem && (
            <p className={cn("mt-3 flex items-start gap-2 text-sm", short || !online ? "text-danger-ink" : "text-muted")}>
              {!online ? <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden /> : short ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
              {problem}
            </p>
          )}
          <Button className="mt-4 w-full" disabled={!!problem} onClick={() => setConfirming(true)} icon={<Send className="size-4" aria-hidden />}>
            Send to {plural(resolved.recipients.length, "member")}
          </Button>
          <p className="mt-2 text-xs text-muted">Credits for messages that fail are returned to the wallet.</p>
        </Card>
        <div aria-hidden className="mx-auto w-64 rounded-[2rem] border-[6px] border-navy bg-cloud p-3 shadow-raised">
          <p className="text-center text-[11px] font-semibold text-muted">{sender}</p>
          <div className="mt-2 min-h-24 rounded-2xl rounded-tl-md bg-white p-3 text-[13px] leading-snug text-ink shadow-card">
            {body.trim() || <span className="text-muted">Your message preview</span>}
          </div>
          <p className="mt-2 text-center text-[10px] text-muted">Preview on a member&apos;s phone</p>
        </div>
      </div>

      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title={`Send to ${plural(resolved.recipients.length, "member")}?`}
          description={`${resolved.label} · ${plural(credits, "credit")} from the wallet.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button onClick={send} icon={<Send className="size-4" aria-hidden />}>
                Send now
              </Button>
            </>
          }
        >
          <p className="whitespace-pre-wrap rounded-xl bg-cloud p-3 text-sm text-ink">{body}</p>
          <p className="mt-3 text-xs text-muted">Sender ID {sender}. Opted-out members never receive messages. This demo doesn&apos;t send real SMS.</p>
        </Modal>
      )}
    </div>
  );
}

function MultiPicker({ churchId, picked, setPicked }: { churchId: string; picked: Member[]; setPicked: (m: Member[]) => void }) {
  const db = useDb();
  const [q, setQ] = useState("");
  const results = useMemo(
    () => (q.trim().length < 2 ? [] : listMembers(db, churchId).filter((m) => matchesMemberQuery(m, q, true) && !picked.some((p) => p.id === m.id)).slice(0, 6)),
    [db, churchId, q, picked],
  );
  return (
    <div>
      {picked.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {picked.map((m) => (
            <li key={m.id}>
              <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 py-1 pl-3 pr-1 text-sm font-medium text-navy">
                {m.first_name} {m.last_name}
                <button type="button" aria-label={`Remove ${m.first_name} ${m.last_name}`} onClick={() => setPicked(picked.filter((p) => p.id !== m.id))} className="inline-flex size-7 items-center justify-center rounded-full hover:bg-white">
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Input aria-label="Add members by name or phone" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name or last 4 digits" className="sm:max-w-sm" />
      {results.length > 0 && (
        <ul className="mt-1 max-w-sm rounded-xl border border-line bg-white p-1 shadow-raised">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  setPicked([...picked, m]);
                  setQ("");
                }}
                className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-navy-50"
              >
                {m.first_name} {m.last_name}
                {m.sms_opt_out && <Badge tone="excused" className="ml-auto">Opted out</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_BADGE: Record<Message["status"], { label: string; tone: "neutral" | "new" | "active" }> = {
  queued: { label: "Queued", tone: "neutral" },
  sending: { label: "Sending", tone: "new" },
  sent: { label: "Sent", tone: "new" },
  delivered: { label: "Delivered", tone: "active" },
};

function History() {
  const db = useDb();
  const { church } = useChurch();
  const messages = listMessages(db, church.id);
  if (!messages.length) return <EmptyState title="No messages yet" body="Messages you send appear here with delivery counts." />;
  return (
    <ul className="flex flex-col gap-3">
      {messages.map((m) => {
        const badge = STATUS_BADGE[m.status];
        const busy = m.status !== "delivered";
        return (
          <li key={m.id}>
            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={badge.tone}>
                    {busy && <Loader2 className="size-3 animate-spin" aria-hidden />}
                    {!busy && <CheckCheck className="size-3" aria-hidden />}
                    {badge.label}
                  </Badge>
                  <span className="text-sm font-semibold text-navy">{m.audience_label}</span>
                  <span className="text-xs text-muted">
                    {fmtDate(m.created_at, "d MMM")} · {fmtTime(m.created_at)} · {m.sent_by}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink">{m.body}</p>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-2 text-sm sm:items-end">
                <p className="tabular text-ink">
                  {busy ? (
                    `${m.recipient_count} recipients`
                  ) : (
                    <>
                      <span className="font-semibold text-teal-ink">{m.delivered}</span> delivered
                      {m.failed > 0 && (
                        <>
                          {" "}
                          · <span className="font-semibold text-danger-ink">{m.failed}</span> failed
                        </>
                      )}
                    </>
                  )}
                </p>
                <p className="tabular text-xs text-muted">
                  {m.credits.toLocaleString("en-US")} credits · {m.segments} SMS each · {m.excluded_opt_out} opted out
                </p>
                {!busy && m.failed > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<RotateCw className="size-3.5" aria-hidden />}
                    onClick={() => {
                      const r = retryFailed(m);
                      toast(r.ok ? "Retry sent" : "Couldn't retry", { tone: r.ok ? "success" : "warning", body: r.ok ? `${r.message.failed ? `${r.message.failed} still failing.` : "All delivered."}` : r.error });
                    }}
                  >
                    Retry {m.failed} failed
                  </Button>
                )}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function Credits() {
  const db = useDb();
  const { church } = useChurch();
  const balance = walletBalance(db, church.id);
  const history = walletHistory(db, church.id);
  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-6">
      <Card className="p-5">
        <p className="text-sm text-muted">Wallet balance</p>
        <p className="tabular mt-1 font-heading text-4xl font-extrabold text-navy">{balance.toLocaleString("en-US")}</p>
        <p className="mt-1 text-xs text-muted">1 credit = 1 SMS segment to 1 member</p>
        <Button className="mt-4 w-full" variant="secondary" onClick={() => fullVersionToast("Buying SMS credits from ComNet")}>
          Buy credits
        </Button>
      </Card>
      <Card className="min-w-0">
        <CardHeader title="Wallet history" subtitle="Every credit added, used or returned" />
        <div className="mt-4">
          <Table>
            <caption className="sr-only">Wallet history</caption>
            <THead>
              <tr>
                <TH scope="col">Date</TH>
                <TH scope="col">What</TH>
                <TH scope="col" className="text-right">
                  Credits
                </TH>
              </tr>
            </THead>
            <tbody>
              {history.map((w) => (
                <TR key={w.id}>
                  <TD className="whitespace-nowrap text-muted">{fmtDate(w.created_at, "d MMM yyyy")}</TD>
                  <TD className="text-ink">{w.note}</TD>
                  <TD className={cn("tabular whitespace-nowrap text-right font-semibold", w.credits > 0 ? "text-teal-ink" : "text-navy")}>
                    {w.credits > 0 ? "+" : "−"}
                    {Math.abs(w.credits).toLocaleString("en-US")}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
