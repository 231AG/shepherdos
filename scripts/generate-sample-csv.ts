// Builds public/samples/members_notebook.csv: a messy "church notebook" export
// for the import wizard demo, and checks it reviews to the intended counts
// against Grace Fellowship's seed. Run: npx tsx scripts/generate-sample-csv.ts
import { writeFileSync } from "node:fs";
import { startOfDay } from "date-fns";
import { generateSeed } from "../src/mock/seed";
import { Rng } from "../src/mock/prng";
import { FEMALE_FIRST, MALE_FIRST, SURNAMES_COMMON, SURNAMES_OTHER } from "../src/mock/names";
import { reviewImport, guessMapping } from "../src/data/importer";
import { nameSimilarity } from "../src/lib/similarity";
import type { Db } from "../src/data/core";

const now = startOfDay(new Date());
const tables = generateSeed(now, now);
const db = { ...tables, now, epoch: now } as Db;
const grace = tables.churches.find((c) => c.slug === "grace-fellowship")!;
const existing = tables.members.filter((m) => m.church_id === grace.id);
const usedPhones = new Set(existing.map((m) => m.phone).filter(Boolean) as string[]);
const usedNames: string[] = existing.map((m) => `${m.first_name} ${m.last_name}`);
const rng = new Rng("sample-notebook");

const fmtPhone = (national: string, style: number) => {
  const p = national.slice(0, 2), a = national.slice(2, 5), b = national.slice(5);
  switch (style) {
    case 0: return `0${p}${national.slice(2, 3)} ${national.slice(3, 6)} ${national.slice(6)}`; // 0770 123 456
    case 1: return `0${p}${national.slice(2, 3)}-${national.slice(3, 6)}-${national.slice(6)}`; // 0886-777-724
    case 2: return `0${national}`; // 0886777724
    case 3: return `231${national}`; // 231886777724
    case 4: return `(0${p}) ${a}-${b}`;
    default: return `+231 ${p} ${a} ${b}`; // already international
  }
};
const DEPTS = ["Choir", "choir", "Youth/Choir", "WOMEN FELLOWSHIP", "Women", "Men", "Mens Fellowship", "Usher", "ushers", "S.S. teacher", "Evangelism team", "Media", "Youth", "Deacon", "", "", ""];
const DATES = ["12/03/2019", "2015", "Mar 2021", "4/11/2018", "", "", "2009", "Jan 2023"];
const SEX = ["F", "M", "Female", "male", "f", ""];

type Line = [string, string, string, string, string];
const ready: Line[] = [];
let international = 0;
while (ready.length < 198) {
  const female = rng.chance(0.55);
  const first = female ? rng.pick(FEMALE_FIRST) : rng.pick(MALE_FIRST);
  const last = rng.chance(0.6) ? rng.pick(SURNAMES_COMMON) : rng.pick(SURNAMES_OTHER);
  const name = `${first} ${last}`;
  if (usedNames.some((n) => nameSimilarity(n, name) >= 0.9)) continue;
  const prefix = rng.weighted([["77", 5], ["88", 4], ["55", 1]] as const);
  const national = `${prefix}${String(rng.int(0, 9_999_999)).padStart(7, "0")}`;
  if (usedPhones.has(`+231${national}`)) continue;
  usedPhones.add(`+231${national}`);
  usedNames.push(name);
  const style = international < 14 && ready.length % 14 === 3 ? 5 : rng.int(0, 4);
  if (style === 5) international++;
  const displayName = rng.chance(0.15) ? name.toUpperCase() : rng.chance(0.1) ? `${first}  ${last} ` : name;
  ready.push([displayName, fmtPhone(national, style), female ? rng.pick(SEX.filter((s) => !/^m/i.test(s))) : rng.pick(SEX.filter((s) => !/^f/i.test(s))), rng.pick(DEPTS), rng.pick(DATES)]);
}
const dupes: Line[] = [
  ["Esther Kolie", "0886-777-724", "F", "Women Fellowship", "2015"],
  ["Abraham Sumo Jr.", "077 452 4521", "M", "Youth", ""],
  ["Hawa Kamara", "0772262268", "F", "Women", "2020"],
];
const errors: Line[] = [
  ["", "0776 120 334", "F", "Choir", ""],
  ["", "", "", "", "Mar 2022"],
  ["TOTAL", "", "", "", ""],
  ["Musu", "0886 554 012", "F", "Youth", ""],
  ["Peter Jallah", "0123 456", "M", "Men", ""],
  ["Ruth Saah", "N/A", "F", "Women", ""],
  ["Thomas Kromah", "07712345", "M", "Usher", ""],
  ["Annie Brooks", "+1 555 0100", "F", "Choir", ""],
  ["Cyrus Paye", "0991234567", "M", "", "2019"],
  ["Lydia Gaye", "", "F", "Sunday School", ""],
];
// Interleave: duplicates sit at fixed notebook rows (as in the mockup), the
// rest are scattered through the file with a few blank lines.
const body: Line[] = [...ready];
const repeatOf = body[30];
errors.push([...repeatOf] as Line);
const insertAt = (row: number, l: Line) => body.splice(row - 2, 0, l);
[...errors].reverse().forEach((l, i) => insertAt(20 + i * 17, l));
for (const r of [64, 120, 171, 205]) body.splice(r - 2, 0, ["", "", "", "", ""]);
insertAt(47, dupes[0]);
insertAt(88, dupes[1]);
insertAt(156, dupes[2]);

const header = ["No.", "Full Name", "Phone No.", "Sex", "Department", "Date Joined"];
let n = 0;
const csvRows = body.map((l) => (l.every((v) => !v) ? ["", ...l] : [String(++n), ...l]));
const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csv = [header, ...csvRows].map((r) => r.map(esc).join(",")).join("\n") + "\n";
writeFileSync("public/samples/members_notebook.csv", csv);

// Verify with the real review logic.
const records = csvRows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
const review = reviewImport(db, grace.id, records, guessMapping(header));
const summary = { rows: review.rows.length, ready: review.ready.length, duplicates: review.duplicates.length, errors: review.errors.length, blank: review.blank, normalised: review.normalised };
console.log(summary);
console.log(review.duplicates.map((d) => `row ${d.rowNumber}: ${d.name} -> ${d.duplicate!.member.first_name} ${d.duplicate!.member.last_name} (${d.duplicate!.reason})`));
console.log(review.errors.map((e) => `row ${e.rowNumber}: ${e.error}`));
const want = { rows: 212, ready: 198, duplicates: 3, errors: 11, blank: 4, normalised: 187 };
for (const [k, v] of Object.entries(want)) if ((summary as Record<string, number>)[k] !== v) { console.error(`MISMATCH ${k}: ${(summary as Record<string, number>)[k]} != ${v}`); process.exitCode = 1; }
