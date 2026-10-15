/** Name similarity for duplicate detection (Sørensen-Dice on letter pairs). */

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(jr|sr|mr|mrs|ms|rev|dr|sis|bro|deacon)\b\.?/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pairs(s: string): Map<string, number> {
  const out = new Map<string, number>();
  const t = s.replace(/ /g, "");
  for (let i = 0; i < t.length - 1; i++) {
    const p = t.slice(i, i + 2);
    out.set(p, (out.get(p) ?? 0) + 1);
  }
  return out;
}

/** 0..1, where 1 means identical after normalisation. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const pa = pairs(na);
  const pb = pairs(nb);
  let inter = 0;
  let total = 0;
  for (const [, n] of pa) total += n;
  for (const [, n] of pb) total += n;
  for (const [k, n] of pa) inter += Math.min(n, pb.get(k) ?? 0);
  return total ? (2 * inter) / total : 0;
}
