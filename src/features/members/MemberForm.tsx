"use client";

import { useState } from "react";
import { createMember, findMemberByPhone, listDepartments, memberDepartmentsIndex, updateMember, useDb, type MemberInput } from "@/data/repo";
import type { ExceptionKind, Member } from "@/data/types";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { useGuideMark } from "@/components/shell/hooks";

type FormState = {
  first_name: string;
  last_name: string;
  phone: string;
  gender: "" | "female" | "male";
  joined_on: string;
  household: string;
  exception: "" | ExceptionKind;
  exception_reason: string;
  exception_until: string;
  sms_opt_out: boolean;
  department_ids: string[];
};

function fromMember(m: Member | null, deptIds: string[], today: string): FormState {
  return {
    first_name: m?.first_name ?? "",
    last_name: m?.last_name ?? "",
    phone: m?.phone ? formatPhone(m.phone) : "",
    gender: m?.gender ?? "",
    joined_on: m?.joined_on ?? today,
    household: m?.household ?? "",
    exception: m?.exception?.kind ?? "",
    exception_reason: m?.exception?.reason ?? "",
    exception_until: m?.exception?.until ?? "",
    sms_opt_out: m?.sms_opt_out ?? false,
    department_ids: deptIds,
  };
}

/** Add or edit a member. Phones are normalised to +231 as you type. */
export function MemberForm({ open, member, onClose, onSaved }: { open: boolean; member: Member | null; onClose: () => void; onSaved: (m: Member) => void }) {
  const db = useDb();
  const { church } = useChurch();
  const mark = useGuideMark();
  const departments = listDepartments(db, church.id);
  const initialDepts = member ? (memberDepartmentsIndex(db, church.id).get(member.id) ?? []).map((d) => d.id) : [];
  const [form, setForm] = useState<FormState>(() => fromMember(member, initialDepts, toISODate(db.now)));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const phone = form.phone.trim() ? normalizePhone(form.phone) : null;
  const phoneOwner = phone?.ok ? findMemberByPhone(db, church.id, phone.e164!, member?.id) : undefined;

  const save = () => {
    const e: typeof errors = {};
    if (!form.first_name.trim()) e.first_name = "Enter a first name.";
    if (!form.last_name.trim()) e.last_name = "Enter a last name.";
    if (phone && !phone.ok) e.phone = phone.error ?? "Enter a valid phone number.";
    if (phoneOwner) e.phone = `${phoneOwner.first_name} ${phoneOwner.last_name} already uses this number.`;
    if (!form.joined_on) e.joined_on = "Enter the date they joined.";
    else if (form.joined_on > toISODate(new Date())) e.joined_on = "The join date can't be in the future.";
    if (form.exception && form.exception_reason.trim().length < 3) e.exception_reason = "Give a short reason, shown on their profile.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const input: MemberInput = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: phone?.ok ? phone.e164 : null,
      gender: form.gender || null,
      joined_on: form.joined_on,
      household: form.household.trim() || null,
      exception: form.exception ? { kind: form.exception, reason: form.exception_reason.trim(), until: form.exception_until || null } : null,
      sms_opt_out: form.sms_opt_out,
      department_ids: form.department_ids,
    };
    if (member) {
      updateMember(member, input);
      toast("Member updated", { body: `${input.first_name} ${input.last_name}'s profile is saved.` });
      onSaved({ ...member, ...input });
    } else {
      const created = createMember(church.id, input);
      mark("add_member");
      toast("Member added", { body: `${input.first_name} ${input.last_name} is now in the directory.` });
      onSaved(created);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={member ? `Edit ${member.first_name} ${member.last_name}` : "Add member"}
      description={member ? undefined : `New member of ${church.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{member ? "Save changes" : "Add member"}</Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.first_name}>
            {(p) => <Input {...p} autoComplete="off" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />}
          </Field>
          <Field label="Last name" error={errors.last_name}>
            {(p) => <Input {...p} autoComplete="off" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />}
          </Field>
        </div>
        <Field
          label="Phone"
          error={errors.phone ?? (phoneOwner ? `${phoneOwner.first_name} ${phoneOwner.last_name} already uses this number.` : null)}
          hint={phone?.ok ? <span className="font-semibold text-teal-ink">Saved as {formatPhone(phone.e164)}</span> : "Any format: 0886 123 456, 077-123-4567 or +231 77 123 4567. Leave blank if none."}
        >
          {(p) => <Input {...p} inputMode="tel" autoComplete="off" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0886 123 456" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gender">
            {(p) => (
              <Select {...p} value={form.gender} onChange={(e) => set("gender", e.target.value as FormState["gender"])}>
                <option value="">Not recorded</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </Select>
            )}
          </Field>
          <Field label="Date joined" error={errors.joined_on}>
            {(p) => <Input {...p} type="date" value={form.joined_on} max={toISODate(new Date())} onChange={(e) => set("joined_on", e.target.value)} />}
          </Field>
        </div>
        <Field label="Household" hint="Optional. Family name or compound, e.g. Kollie family, Duport Road.">
          {(p) => <Input {...p} value={form.household} onChange={(e) => set("household", e.target.value)} />}
        </Field>

        <fieldset>
          <legend className="text-sm font-semibold text-navy">Departments</legend>
          <p className="text-xs text-muted">A member can belong to several.</p>
          <div className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {departments.map((d) => (
              <Checkbox
                key={d.id}
                label={d.name}
                checked={form.department_ids.includes(d.id)}
                onChange={(e) =>
                  set("department_ids", e.target.checked ? [...form.department_ids, d.id] : form.department_ids.filter((x) => x !== d.id))
                }
              />
            ))}
          </div>
        </fieldset>

        <Field label="Status exception" hint="Excused members are never marked inactive, whatever their attendance.">
          {(p) => (
            <Select {...p} value={form.exception} onChange={(e) => set("exception", e.target.value as FormState["exception"])}>
              <option value="">None</option>
              <option value="homebound">Homebound</option>
              <option value="leave">Approved leave</option>
              <option value="pastoral">Pastoral exception</option>
            </Select>
          )}
        </Field>
        {form.exception && (
          <div className="grid gap-4 rounded-xl bg-cloud p-4">
            <Field label="Reason" error={errors.exception_reason}>
              {(p) => <Textarea {...p} value={form.exception_reason} onChange={(e) => set("exception_reason", e.target.value)} placeholder="e.g. Recovering from surgery; visited by Deacons" />}
            </Field>
            <Field label="Until (optional)">
              {(p) => <Input {...p} type="date" value={form.exception_until} onChange={(e) => set("exception_until", e.target.value)} />}
            </Field>
          </div>
        )}
        <Checkbox label="Opted out of SMS (never included in messages)" checked={form.sms_opt_out} onChange={(e) => set("sms_opt_out", e.target.checked)} />
        <button type="submit" className="sr-only">
          Save
        </button>
      </form>
    </Sheet>
  );
}
