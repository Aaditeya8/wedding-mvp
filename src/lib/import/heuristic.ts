import type { ColumnProfile } from "./profile";
import { EMPTY_FIELDS, type EventRef, type Mapping } from "./mapping";
import { HEADER_SYNONYMS, matchEventName, normalizeHeader, type TargetField } from "./targets";

const SERIAL_HEADERS = new Set(["sno", "s no", "sr no", "sl no", "srno", "slno", "serial", "serial no", "sr", "sl", "no", "index", "id", "row", "number", "#"]);
const MULTI_NAME = /,|&|;|\n|\band\b|\/|\+/;

/** Which column kinds may carry each field. */
const KIND_OK: Record<TargetField, (k: ColumnProfile["kind"]) => boolean> = {
  familyName: (k) => k === "text" || k === "empty",
  guestName: (k) => k === "text" || k === "empty",
  side: (k) => k === "text" || k === "empty",
  relation: (k) => k === "text" || k === "empty",
  email: (k) => k === "email" || k === "empty",
  ageGroup: (k) => k === "text" || k === "number" || k === "empty",
  headcount: (k) => k === "number" || k === "empty",
  eventsList: (k) => k === "text" || k === "empty",
};

/** Order matters: the more specific fields claim their columns first. */
const PRIORITY: TargetField[] = ["email", "familyName", "guestName", "side", "relation", "ageGroup", "headcount", "eventsList"];

function headerScore(header: string, field: TargetField): number {
  const norm = normalizeHeader(header);
  if (!norm) return 0;
  let best = 0;
  for (const syn of HEADER_SYNONYMS[field]) {
    if (norm === syn) return 1;
    if (new RegExp(`\\b${syn}\\b`).test(norm)) best = Math.max(best, 0.8);
  }
  return best;
}

function isSerialColumn(p: ColumnProfile): boolean {
  if (SERIAL_HEADERS.has(normalizeHeader(p.header))) return true;
  if (p.kind !== "number" || p.filled < 3) return false;
  // 1,2,3… with no repeats
  return p.distinct === p.filled && p.samples.slice(0, 3).join(",") === "1,2,3";
}

export function heuristicMapping(profiles: ColumnProfile[], events: EventRef[]): Mapping {
  const fields: Record<TargetField, number | null> = { ...EMPTY_FIELDS };
  const confidence: Mapping["confidence"] = {};
  const eventColumns: Record<string, number | null> = {};
  const used = new Set<number>();
  const eventNames = events.map((e) => e.name);

  for (const p of profiles) if (isSerialColumn(p)) used.add(p.index);

  // Per-event yes/no columns: header names an event, cells are booleans (or empty)
  for (const p of profiles) {
    if (used.has(p.index) || !(p.kind === "boolean" || p.kind === "empty")) continue;
    const name = matchEventName(p.header, eventNames);
    if (!name) continue;
    const ev = events.find((e) => e.name === name)!;
    if (eventColumns[ev.id] !== undefined && eventColumns[ev.id] !== null) continue;
    eventColumns[ev.id] = p.index;
    used.add(p.index);
  }

  // Header synonyms, specific fields first
  for (const field of PRIORITY) {
    let best: { index: number; score: number } | null = null;
    for (const p of profiles) {
      if (used.has(p.index) || !KIND_OK[field](p.kind)) continue;
      const score = headerScore(p.header, field);
      if (score > 0 && (!best || score > best.score)) best = { index: p.index, score };
    }
    if (best) {
      fields[field] = best.index;
      confidence[field] = best.score === 1 ? 0.9 : 0.75;
      used.add(best.index);
    }
  }

  // Value-kind fallbacks
  if (fields.email === null) {
    const p = profiles.find((p) => !used.has(p.index) && p.kind === "email");
    if (p) { fields.email = p.index; confidence.email = 0.6; used.add(p.index); }
  }
  if (fields.guestName === null && fields.familyName === null) {
    const p = profiles
      .filter((p) => !used.has(p.index) && p.kind === "text" && p.fillRate >= 0.8)
      .sort((a, b) => b.distinct - a.distinct)[0];
    if (p) { fields.guestName = p.index; confidence.guestName = 0.4; used.add(p.index); }
  }

  // Granularity: one person per row, or one household per row?
  let granularity: Mapping["granularity"] = "family";
  if (fields.guestName !== null) {
    const nameCol = profiles[fields.guestName];
    const multiShare = nameCol.samples.length
      ? nameCol.samples.filter((s) => MULTI_NAME.test(s)).length / nameCol.samples.length
      : 0;
    const emailCol = fields.email !== null ? profiles[fields.email] : null;
    const emailRepeats = emailCol ? emailCol.distinct < emailCol.filled : false;
    if (multiShare >= 0.3) granularity = "family";
    else if (fields.familyName !== null) granularity = "guest";
    else if (emailRepeats) granularity = "guest";
    else if (fields.headcount !== null) granularity = "family";
    else granularity = "family";
  }

  return { granularity, fields, eventColumns, confidence };
}
