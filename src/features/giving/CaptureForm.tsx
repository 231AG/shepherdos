"use client";

import { useState } from "react";
import { Lock, WifiOff } from "lucide-react";
import { postGiving, saveGivingDraft } from "@/data/repo";
import { GIVING_TYPES, type Currency, type GivingType, type Member, type Service } from "@/data/types";
import { useDemoStore } from "@/data/store";
import { GIVING_TYPE_SINGULAR } from "@/lib/giving";
import { formatMoney, parseAmountToMinor } from "@/lib/money";
import { canSeeContacts } from "@/lib/access";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { useGuideMark } from "@/components/shell/hooks";
import { MemberPicker } from "./MemberPicker";

/** Record giving. Online: post straight to the ledger or save a draft. Offline: drafts only. */
export function CaptureForm({ service, dayClosed }: { service: Service; dayClosed: boolean }) {
  const { church, role, persona } = useChurch();
  const online = useDemoStore((s) => s.online);
  const mark = useGuideMark();
  const [currency, setCurrency] = useState<Currency>("LRD");
  const [type, setType] = useState<GivingType>("tithe");
  const [member, setMember] = useState<Member | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [anonLabel, setAnonLabel] = useState("Anonymous");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const input = () => {
    const minor = parseAmountToMinor(amount);
    if (!anonymous && !member) return { err: "Choose the giver, or tick Anonymous / loose offering." };
    if (!minor) return { err: "Enter an amount, for example 5000 or 12.50." };
    return {
      value: {
        church_id: church.id,
        service,
        member_id: anonymous ? null : member!.id,
        giver_label: anonymous ? anonLabel : null,
        type,
        currency,
        amount_minor: minor,
      },
    };
  };
  const who = () => (anonymous ? anonLabel : `${member!.first_name} ${member!.last_name}`);
  const reset = () => {
    setAmount("");
    setMember(null);
    setError(null);
  };

  const post = () => {
    const i = input();
    if (i.err) return setError(i.err);
    const r = postGiving(i.value!, persona.display);
    if (!r.ok) return setError(r.error);
    mark("record_giving");
    toast(`${r.value.ref} posted`, { body: `${formatMoney(r.value.amount_minor, r.value.currency)} ${GIVING_TYPE_SINGULAR[type].toLowerCase()} from ${who()}.` });
    reset();
  };
  const draft = () => {
    const i = input();
    if (i.err) return setError(i.err);
    const r = saveGivingDraft(i.value!, online ? persona.display : "This device", online);
    if (!r.ok) return setError(r.error);
    mark("record_giving");
    toast(online ? "Draft saved" : "Draft saved on this device", {
      tone: online ? "success" : "warning",
      body: `${formatMoney(r.value.amount_minor, r.value.currency)} from ${who()}. Not in totals until a treasurer posts it.`,
    });
    reset();
  };

  const locked = dayClosed;
  return (
    <Card className="p-5">
      <h2 className="text-[17px] font-bold">Record giving</h2>
      {locked && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-slate-soft px-3 py-2.5 text-sm text-slate-ink">
          <Lock className="size-4 shrink-0" aria-hidden /> This day is closed. Choose an open service to record giving.
        </p>
      )}
      {!online && !locked && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-gold-soft px-3 py-2.5 text-sm text-gold-ink">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden /> You&apos;re offline. Entries are saved as drafts on this device and need treasurer review before they count.
        </p>
      )}
      <fieldset disabled={locked} className="mt-4 flex flex-col gap-4 disabled:opacity-60">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-navy" id="currency-label">
            Currency
          </span>
          <div role="group" aria-labelledby="currency-label" className="grid grid-cols-2 gap-1 rounded-xl border border-line-strong p-1">
            {(["LRD", "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={currency === c}
                onClick={() => setCurrency(c)}
                className={cn("h-10 rounded-lg text-sm font-bold transition-colors", currency === c ? "bg-navy text-white" : "text-navy hover:bg-navy-50")}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <Field label="Giving type">
          {(p) => (
            <Select {...p} value={type} onChange={(e) => setType(e.target.value as GivingType)}>
              {GIVING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {GIVING_TYPE_SINGULAR[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <MemberPicker churchId={church.id} value={member} onChange={setMember} allowPhone={canSeeContacts(role)} disabled={anonymous || locked} />
        <div>
          <Checkbox
            label="Anonymous / loose offering"
            checked={anonymous}
            onChange={(e) => {
              setAnonymous(e.target.checked);
              if (e.target.checked) setMember(null);
            }}
          />
          {anonymous && (
            <div role="group" aria-label="Kind of unnamed giving" className="mt-1 flex gap-2">
              {["Anonymous", "Loose offering count"].map((l) => (
                <Button key={l} size="sm" variant={anonLabel === l ? "primary" : "secondary"} aria-pressed={anonLabel === l} onClick={() => setAnonLabel(l)}>
                  {l}
                </Button>
              ))}
            </div>
          )}
        </div>
        <Field label="Amount" error={error}>
          {(p) => (
            <div className="flex">
              <span className="inline-flex h-11 items-center rounded-l-xl border border-r-0 border-line-strong bg-navy-50 px-3 text-sm font-bold text-navy">{currency}</span>
              <Input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="rounded-l-none" />
            </div>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={post} disabled={!online} title={online ? undefined : "Posting needs a connection. Save a draft instead."}>
            Post entry
          </Button>
          <Button variant={online ? "secondary" : "primary"} onClick={draft}>
            Save as draft
          </Button>
        </div>
      </fieldset>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-cloud px-3 py-2.5 text-xs leading-relaxed text-ink">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
        Posted entries can&apos;t be edited or deleted. Corrections are posted as a reversal with a reason, linked to the original.
      </p>
    </Card>
  );
}
