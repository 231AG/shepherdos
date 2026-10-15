/**
 * Liberian phone numbers. Stored as E.164 (+231XXXXXXXXX, 9 national digits),
 * displayed as `+231 77 123 4567`.
 */

const VALID_PREFIXES = ["77", "88", "55"] as const;

export interface PhoneResult {
  ok: boolean;
  e164: string | null;
  error: string | null;
}

export function normalizePhone(raw: string | null | undefined): PhoneResult {
  const input = (raw ?? "").trim();
  if (!input) return { ok: false, e164: null, error: "Phone number is empty" };
  let digits = input.replace(/\D/g, "");
  if (!digits) return { ok: false, e164: null, error: "Not a phone number" };
  if (input.startsWith("+") && !input.replace(/\s/g, "").startsWith("+231")) {
    return { ok: false, e164: null, error: "Not a Liberian (+231) number" };
  }
  if (digits.startsWith("00231")) digits = digits.slice(5);
  else if (digits.startsWith("231") && digits.length === 12) digits = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 10) digits = digits.slice(1);

  if (digits.length !== 9) {
    return { ok: false, e164: null, error: "Liberian mobile numbers have 9 digits after +231" };
  }
  if (!VALID_PREFIXES.some((p) => digits.startsWith(p))) {
    return { ok: false, e164: null, error: "Number should start with 077, 088 or 055" };
  }
  return { ok: true, e164: `+231${digits}`, error: null };
}

/** `+231771234567` → `+231 77 123 4567` */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+231(\d{2})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `+231 ${m[1]} ${m[2]} ${m[3]}`;
}

/** `+231 77 ••• 4521`, used in tight lists such as check-in. */
export function formatPhoneShort(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+231(\d{2})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `+231 ${m[1]} ••• ${m[3]}`;
}

/** Matches a search query against a phone: full digits or the last 4. */
export function phoneMatches(e164: string | null, query: string): boolean {
  if (!e164) return false;
  const q = query.replace(/\D/g, "");
  if (q.length < 3) return false;
  const national = e164.replace(/^\+231/, "");
  return e164.replace(/\D/g, "").includes(q) || `0${national}`.includes(q);
}
