/** Join class names, skipping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function initials(first: string, last?: string): string {
  if (last !== undefined) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  const words = first.replace(/^(Rev\.|Sis\.|Bro\.|Deacon|Dr\.|Mrs?\.)\s+/i, "").split(/\s+/);
  return `${words[0]?.charAt(0) ?? ""}${words[words.length - 1]?.charAt(0) ?? ""}`.toUpperCase();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
