"use client";

import { useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { listMembers, matchesMemberQuery, useDb } from "@/data/repo";
import type { Member } from "@/data/types";
import { initials } from "@/lib/cn";
import { Input } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/misc";

/** Search-as-you-type member picker. Phone lookup only for roles that may see phones. */
export function MemberPicker({
  churchId,
  value,
  onChange,
  allowPhone,
  disabled,
  label = "Giver",
}: {
  churchId: string;
  value: Member | null;
  onChange: (m: Member | null) => void;
  allowPhone: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const db = useDb();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const id = useId();
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    return listMembers(db, churchId)
      .filter((m) => matchesMemberQuery(m, q, allowPhone))
      .slice(0, 6);
  }, [db, churchId, q, allowPhone]);

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-navy">{label}</span>
        <div className="flex h-11 items-center gap-2 rounded-xl border border-teal/50 bg-teal-soft/40 pl-2 pr-1">
          <Avatar initials={initials(value.first_name, value.last_name)} size="sm" className="size-7" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-navy">
            {value.first_name} {value.last_name}
          </span>
          <button
            type="button"
            aria-label={`Remove ${value.first_name} ${value.last_name}`}
            onClick={() => onChange(null)}
            disabled={disabled}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-white hover:text-navy"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-navy">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          id={id}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={allowPhone ? "Search member by name or phone" : "Search member by name"}
          className="pl-9"
        />
      </div>
      {open && q.trim().length >= 2 && (
        <ul id={`${id}-list`} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-overlay">
          {results.length === 0 && <li className="px-3 py-3 text-sm text-muted">No member matches. Tick &ldquo;Anonymous&rdquo; for loose offering.</li>}
          {results.map((m) => (
            <li key={m.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(m);
                  setQ("");
                  setOpen(false);
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-navy-50"
              >
                <Avatar initials={initials(m.first_name, m.last_name)} size="sm" className="size-7" />
                <span className="font-semibold text-navy">
                  {m.first_name} {m.last_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
