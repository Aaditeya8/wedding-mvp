import type { ImportRow } from "./normalize";

/** What we know about a family already on the list, for duplicate detection. */
export type ExistingFamily = { id: string; name: string; email: string; members: string[] };
export type MatchReason = "email" | "name" | "members";
export type Match = { id: string; reason: MatchReason };

const FAMILY_STOP = new Set([
  "the", "family", "families", "parivar", "parivaar", "pariwar", "house", "household", "home",
  "ji", "and", "group", "of", "wale", "waale", "sahab", "saheb", "fam", "clan", "n",
]);
const HONORIFIC = /^(mr|mrs|ms|miss|dr|shri|sri|smt|late|master|kumari|prof)$/;
const PLACEHOLDER = /^guest\s*\d+$/;

/** "The Sharma Family" / "Sharma Parivar" / "Sharmas" → "sharma" */
export function normalizeFamilyName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const tokens = base.split(" ").filter((t) => t && !FAMILY_STOP.has(t));
  let out = tokens.join(" ");
  if (tokens.length === 1 && out.length > 4 && out.endsWith("s") && !out.endsWith("ss")) out = out.slice(0, -1);
  return out;
}

/** "Dr. Rajesh  Sharma" → "rajesh sharma"; placeholders ("Guest 3") → null */
export function normalizePersonName(name: string): string | null {
  const s = name.toLowerCase().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  if (!s || PLACEHOLDER.test(s)) return null;
  const out = s.split(" ").filter((t) => t && !HONORIFIC.test(t)).join(" ");
  return out || null;
}

/**
 * Is this row a household we already have? Email wins; else the normalised household
 * name; else enough of the same people. Never fuzzier than that — the committee sees
 * the flag and decides.
 */
export function matchExisting(row: ImportRow, existing: ExistingFamily[]): Match | null {
  const email = row.email.trim().toLowerCase();
  if (email) {
    const hit = existing.find((f) => f.email.trim().toLowerCase() === email);
    if (hit) return { id: hit.id, reason: "email" };
  }

  const norm = normalizeFamilyName(row.name);
  if (norm) {
    const hit = existing.find((f) => normalizeFamilyName(f.name) === norm);
    if (hit) return { id: hit.id, reason: "name" };
  }

  const people = new Set(row.members.map((m) => normalizePersonName(m.fullName)).filter((n): n is string => !!n));
  if (people.size === 0) return null;
  let best: { id: string; ratio: number } | null = null;
  for (const f of existing) {
    const theirs = new Set(f.members.map(normalizePersonName).filter((n): n is string => !!n));
    if (theirs.size === 0) continue;
    let shared = 0;
    for (const p of people) if (theirs.has(p)) shared++;
    const ratio = shared / Math.min(people.size, theirs.size);
    if (shared >= 1 && ratio >= 0.5 && (!best || ratio > best.ratio)) best = { id: f.id, ratio };
  }
  return best ? { id: best.id, reason: "members" } : null;
}
