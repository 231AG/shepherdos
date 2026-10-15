"use client";

/**
 * Notebook spreadsheet import: column mapping, review (normalisation,
 * duplicates, errors) and commit. Pure functions except `commitImport`.
 * Re-exported by repo.ts.
 */
import { isValid, parse } from "date-fns";
import { randomUuid } from "@/mock/prng";
import { normalizePhone } from "@/lib/phone";
import { nameSimilarity } from "@/lib/similarity";
import { toISODate } from "@/lib/dates";
import { addRow, addRows, currentDb, patchRows, type Db } from "./core";
import { listDepartments, listMembers, memberName } from "./repo";
import type { Department, Member, MemberDepartment } from "./types";

export type ImportField = "full_name" | "first_name" | "last_name" | "phone" | "gender" | "department" | "joined";

export const IMPORT_FIELDS: { key: ImportField; label: string; hint: string }[] = [
  { key: "full_name", label: "Full name", hint: "Or map first and last name separately" },
  { key: "first_name", label: "First name", hint: "Optional if full name is mapped" },
  { key: "last_name", label: "Last name", hint: "Optional if full name is mapped" },
  { key: "phone", label: "Phone", hint: "Any format: 077…, 0886…, +231…" },
  { key: "gender", label: "Gender", hint: "M / F / Male / Female" },
  { key: "department", label: "Department", hint: "Several allowed: Youth/Choir" },
  { key: "joined", label: "Date joined", hint: "Blank dates use today" },
];

export type ImportMapping = Record<ImportField, string | null>;

const GUESS: Record<ImportField, RegExp> = {
  full_name: /^(full\s*)?name|member( name)?$/i,
  first_name: /^first|given|fore/i,
  last_name: /^(last|sur)\s*name|^surname|^family/i,
  phone: /phone|tel|mobile|cell|contact/i,
  gender: /^(sex|gender)$/i,
  department: /dept|department|ministry|group/i,
  joined: /join|date|since/i,
};

export function guessMapping(headers: string[]): ImportMapping {
  const used = new Set<string>();
  const out = {} as ImportMapping;
  for (const f of ["first_name", "last_name", "full_name", "phone", "gender", "department", "joined"] as ImportField[]) {
    const h = headers.find((x) => !used.has(x) && GUESS[f].test(x.trim()));
    out[f] = h ?? null;
    if (h) used.add(h);
  }
  return out;
}

export function mappingProblem(m: ImportMapping): string | null {
  if (!m.full_name && !(m.first_name && m.last_name)) return "Map a Full name column, or both First and Last name.";
  if (!m.phone) return "Map the Phone column so members can be matched and messaged.";
  return null;
}

const DEPT_KEYWORDS: [RegExp, string][] = [
  [/women|ladies|wf\b/i, "Women's Fellowship"],
  [/\bmen\b|men'?s|brotherhood/i, "Men's Fellowship"],
  [/choir|praise|music/i, "Choir"],
  [/usher/i, "Ushers"],
  [/youth|young/i, "Youth"],
  [/sunday\s*school|s\.?s\.?\b|children/i, "Sunday School"],
  [/deacon/i, "Deacons"],
  [/evangel|outreach/i, "Evangelism"],
  [/media|sound|camera/i, "Media"],
];

function matchDepartments(text: string, departments: Department[]): string[] {
  const ids = new Set<string>();
  for (const part of text.split(/[/,;&+]| and /i)) {
    for (const [re, name] of DEPT_KEYWORDS) {
      if (re.test(part)) {
        const d = departments.find((x) => x.name === name);
        if (d) ids.add(d.id);
        break;
      }
    }
  }
  return [...ids];
}

const DATE_FORMATS = ["d/M/yyyy", "d-M-yyyy", "yyyy-MM-dd", "MMM yyyy", "MMMM yyyy", "d MMM yyyy", "yyyy"];
function parseJoined(text: string, today: Date): string {
  const t = text.trim();
  if (!t) return toISODate(today);
  for (const f of DATE_FORMATS) {
    const d = parse(t, f, today);
    if (isValid(d) && d.getFullYear() > 1950 && d <= today) return toISODate(d);
  }
  return toISODate(today);
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  const suffix = /^(jr|sr|ii|iii)\.?$/i.test(parts[parts.length - 1]);
  const lastIdx = suffix && parts.length > 2 ? parts.length - 2 : parts.length - 1;
  return { first: parts.slice(0, lastIdx).join(" "), last: parts.slice(lastIdx).join(" ") };
}

export interface ReviewRow {
  /** 1-based row number in the file, counting the header as row 1. */
  rowNumber: number;
  name: string;
  first: string;
  last: string;
  rawPhone: string;
  phone: string | null;
  normalised: boolean;
  gender: Member["gender"];
  departmentIds: string[];
  departmentText: string;
  joined_on: string;
  error: string | null;
  duplicate: { member: Member; reason: string } | null;
}

export interface ImportReview {
  rows: ReviewRow[];
  ready: ReviewRow[];
  duplicates: ReviewRow[];
  errors: ReviewRow[];
  blank: number;
  normalised: number;
}

/** Names that are clearly not people (totals, headings). */
const NOT_A_NAME = /^(total|sub\s*total|page \d+|names?|members?|n\/?a)$/i;

export function reviewImport(db: Db, churchId: string, data: Record<string, string>[], mapping: ImportMapping): ImportReview {
  const departments = listDepartments(db, churchId);
  const existing = listMembers(db, churchId);
  const byPhone = new Map(existing.filter((m) => m.phone).map((m) => [m.phone!, m]));
  const seenInFile = new Map<string, number>();
  const rows: ReviewRow[] = [];
  let blank = 0;
  const get = (r: Record<string, string>, f: ImportField) => (mapping[f] ? (r[mapping[f]!] ?? "").trim() : "");

  data.forEach((r, i) => {
    const rowNumber = i + 2;
    if (Object.values(r).every((v) => !String(v ?? "").trim())) {
      blank++;
      return;
    }
    let first = get(r, "first_name");
    let last = get(r, "last_name");
    const full = get(r, "full_name");
    if (full && !(first && last)) ({ first, last } = splitName(full));
    const name = `${first} ${last}`.trim();
    const rawPhone = get(r, "phone");
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    const g = get(r, "gender").toLowerCase();
    const departmentText = get(r, "department");
    const row: ReviewRow = {
      rowNumber,
      name,
      first,
      last,
      rawPhone,
      phone: phone?.ok ? phone.e164 : null,
      normalised: !!phone?.ok && rawPhone.replace(/\s/g, "") !== phone.e164,
      gender: g.startsWith("f") ? "female" : g.startsWith("m") ? "male" : null,
      departmentIds: matchDepartments(departmentText, departments),
      departmentText,
      joined_on: parseJoined(get(r, "joined"), db.now),
      error: null,
      duplicate: null,
    };
    const key = `${name.toLowerCase()}|${row.phone ?? rawPhone}`;
    if (!name) row.error = "Name is missing";
    else if (NOT_A_NAME.test(name)) row.error = "Not a member's name";
    else if (!last) row.error = "Only one name given";
    else if (!rawPhone) row.error = "Phone number is missing";
    else if (!phone?.ok) row.error = `Phone "${rawPhone}": ${phone?.error ?? "not valid"}`;
    else if (seenInFile.has(key)) row.error = `Repeats row ${seenInFile.get(key)} in this file`;
    if (!row.error) {
      seenInFile.set(key, rowNumber);
      const samePhone = row.phone ? byPhone.get(row.phone) : undefined;
      if (samePhone) {
        const sim = nameSimilarity(name, memberName(samePhone));
        const suffixOnly = sim === 1 && name.toLowerCase() !== memberName(samePhone).toLowerCase();
        row.duplicate = {
          member: samePhone,
          reason: suffixOnly
            ? "Same phone · different suffix (could be family)"
            : sim === 1
              ? "Same name and phone"
              : sim >= 0.8
                ? `Same phone · name ${Math.round(sim * 100)}% similar`
                : "Same phone · different name (could be family)",
        };
      } else {
        const similar = existing.find((m) => nameSimilarity(name, memberName(m)) >= 0.9);
        if (similar) row.duplicate = { member: similar, reason: `Name ${Math.round(nameSimilarity(name, memberName(similar)) * 100)}% similar · different phone` };
      }
    }
    rows.push(row);
  });

  return {
    rows,
    ready: rows.filter((r) => !r.error && !r.duplicate),
    duplicates: rows.filter((r) => !r.error && r.duplicate),
    errors: rows.filter((r) => r.error),
    blank,
    normalised: rows.filter((r) => !r.error && r.normalised).length,
  };
}

export type DuplicateChoice = "merge" | "keep" | "skip";

export interface ImportResult {
  added: number;
  merged: number;
  skipped: number;
}

/**
 * Write the reviewed rows. Ready rows and "keep both" duplicates become new
 * members; "merge" adds missing details (departments, gender, phone) to the
 * existing member; "skip" does nothing. Runs once per confirmed review.
 */
export function commitImport(
  churchId: string,
  review: ImportReview,
  choices: Record<number, DuplicateChoice>,
  fileName: string,
  importedBy: string,
): ImportResult {
  const now = new Date().toISOString();
  const toCreate = [...review.ready, ...review.duplicates.filter((r) => choices[r.rowNumber] === "keep")];
  const members: Member[] = [];
  const links: MemberDepartment[] = [];
  for (const r of toCreate) {
    const id = randomUuid();
    members.push({
      id,
      church_id: churchId,
      first_name: r.first,
      last_name: r.last,
      phone: r.phone,
      gender: r.gender,
      joined_on: r.joined_on,
      exception: null,
      sms_opt_out: false,
      household: null,
      converted_from_prospect_id: null,
      imported_at: now,
      created_at: now,
    });
    for (const department_id of r.departmentIds) links.push({ id: randomUuid(), church_id: churchId, member_id: id, department_id, created_at: now });
  }
  const db = currentDb();
  const patches: Record<string, Partial<Member>> = {};
  let merged = 0;
  for (const r of review.duplicates.filter((x) => choices[x.rowNumber] === "merge")) {
    const m = r.duplicate!.member;
    merged++;
    const patch: Partial<Member> = {};
    if (!m.gender && r.gender) patch.gender = r.gender;
    if (!m.phone && r.phone) patch.phone = r.phone;
    if (Object.keys(patch).length) patches[m.id] = patch;
    const have = new Set(db.member_departments.filter((md) => md.member_id === m.id).map((md) => md.department_id));
    for (const department_id of r.departmentIds.filter((d) => !have.has(d))) {
      links.push({ id: randomUuid(), church_id: churchId, member_id: m.id, department_id, created_at: now });
    }
  }
  addRows("members", members);
  addRows("member_departments", links);
  patchRows("members", patches);
  const skipped = review.duplicates.filter((r) => choices[r.rowNumber] === "skip").length;
  addRow("import_jobs", {
    id: randomUuid(),
    church_id: churchId,
    file_name: fileName,
    rows: review.rows.length,
    added: members.length,
    merged,
    skipped,
    errors: review.errors.length,
    imported_by: importedBy,
    created_at: now,
  });
  return { added: members.length, merged, skipped };
}

export function lastImportJob(db: Db, churchId: string) {
  return db.import_jobs.filter((j) => j.church_id === churchId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}
