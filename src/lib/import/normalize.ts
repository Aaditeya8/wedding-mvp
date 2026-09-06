import type { Sheet } from "./spreadsheet";
import { EMAIL_RE } from "./profile";
import { mainEvents, type Answers, type EventRef, type Mapping } from "./mapping";
import { matchEventName, parseAgeGroup, parseBoolean, parseSide } from "./targets";

export type IssueCode =
  | "missing_name" | "missing_email" | "invalid_email" | "unknown_side"
  | "no_members" | "no_events" | "duplicate_in_sheet" | "exists";

export type Member = { fullName: string; ageGroup: "adult" | "child" };

export type ImportRow = {
  key: string;
  name: string;
  side: "bride" | "groom" | "both";
  relation: string;
  email: string;
  members: Member[];
  eventIds: string[];
  issues: IssueCode[];
  /** 0-based indexes into Sheet.rows this household came from */
  sourceRows: number[];
};

export type BuildStats = { sourceRows: number; households: number; withIssues: number };

const NAME_SEP = /\s*(?:,|;|\/|\+|&|\band\b|\n)\s*/i;
const CHILD_MARK = /\s*[\(\[\-–]\s*(child|kid|baby|infant|toddler|minor|\d{1,2}\s*(?:y|yr|yrs|years?|yo)?)\s*[\)\]]?\s*$/i;

export function splitNames(cell: string): string[] {
  return cell.split(NAME_SEP).map((s) => s.trim()).filter(Boolean);
}

/** "Riya (child)" / "Myra (6)" / "Aarav - kid" → child; everything else adult. */
export function parseMembersCell(cell: string): Member[] {
  return splitNames(cell).map((raw) => {
    const m = raw.match(CHILD_MARK);
    if (!m) return { fullName: raw, ageGroup: "adult" as const };
    const marker = m[1].replace(/[^a-z0-9]/gi, "");
    const age = parseAgeGroup(marker.replace(/[a-z]+$/i, "")) ?? parseAgeGroup(marker);
    return { fullName: raw.slice(0, m.index).trim() || raw, ageGroup: age ?? "adult" };
  });
}

function surname(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/).filter((p) => !/^(mr|mrs|ms|dr|shri|smt|late)\.?$/i.test(p));
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function familyFromMember(fullName: string): string {
  const s = surname(fullName);
  return s ? `${s} Family` : fullName;
}

function familyFromGroupValue(value: string): string {
  const v = value.trim();
  return /\s/.test(v) ? v : `${v} Family`;
}

type Extracted = {
  row: number;
  familyName: string;
  guestName: string;
  side: ReturnType<typeof parseSide>;
  sideRaw: string;
  relation: string;
  email: string;
  members: Member[];
  eventIds: string[];
};

function eventIdsForRow(cells: string[], mapping: Mapping, answers: Answers, events: EventRef[]): string[] {
  const perEvent = Object.entries(mapping.eventColumns).filter(([, i]) => i !== null) as [string, number][];
  const sorted = [...events].sort((a, b) => a.sortOrder - b.sortOrder);
  if (perEvent.length) {
    return sorted.filter((e) => perEvent.some(([id, i]) => id === e.id && parseBoolean(cells[i] ?? "") === true)).map((e) => e.id);
  }
  if (mapping.fields.eventsList !== null) {
    const names = new Set(
      (cells[mapping.fields.eventsList] ?? "").split(/\s*(?:,|;|\/|\||&|\band\b|\n)\s*/i).map((s) => s.trim()).filter(Boolean)
        .map((s) => matchEventName(s, events.map((e) => e.name))).filter((n): n is string => !!n),
    );
    return sorted.filter((e) => names.has(e.name)).map((e) => e.id);
  }
  const choice = typeof answers.events === "string" ? answers.events : "all";
  if (choice === "main") return mainEvents(events).map((e) => e.id);
  if (choice === "choose") {
    const chosen = new Set(Array.isArray(answers.eventsChosen) ? answers.eventsChosen : []);
    return sorted.filter((e) => chosen.has(e.id)).map((e) => e.id);
  }
  return sorted.map((e) => e.id);
}

function extract(sheet: Sheet, mapping: Mapping, answers: Answers, events: EventRef[]): Extracted[] {
  const f = mapping.fields;
  const cell = (cells: string[], i: number | null) => (i === null ? "" : (cells[i] ?? "").trim());
  return sheet.rows.map((cells, row) => {
    const guestName = cell(cells, f.guestName);
    const ageRaw = cell(cells, f.ageGroup);
    const headcount = Number.parseInt(cell(cells, f.headcount), 10);

    let members: Member[];
    if (mapping.granularity === "guest") {
      members = guestName ? [{ fullName: guestName, ageGroup: parseAgeGroup(ageRaw) ?? "adult" }] : [];
    } else {
      members = parseMembersCell(guestName);
      if (members.length && ageRaw) {
        const ag = parseAgeGroup(ageRaw);
        if (ag && members.length === 1) members[0].ageGroup = ag;
      }
      if (!members.length && Number.isFinite(headcount) && headcount > 0) {
        members = Array.from({ length: Math.min(headcount, 50) }, (_, i) => ({ fullName: `Guest ${i + 1}`, ageGroup: "adult" as const }));
      }
    }

    const sideRaw = cell(cells, f.side);
    return {
      row,
      familyName: cell(cells, f.familyName),
      guestName,
      side: parseSide(sideRaw),
      sideRaw,
      relation: cell(cells, f.relation),
      email: cell(cells, f.email).toLowerCase(),
      members,
      eventIds: eventIdsForRow(cells, mapping, answers, events),
    };
  });
}

function groupKey(e: Extracted, mode: string, sheet: Sheet): { key: string; value: string } | null {
  if (mode.startsWith("column:")) {
    const i = Number(mode.slice(7));
    const v = (sheet.rows[e.row][i] ?? "").trim();
    return v ? { key: `c:${v.toLowerCase()}`, value: v } : null;
  }
  if (mode === "email") return e.email ? { key: `e:${e.email}`, value: e.email } : null;
  if (mode === "surname") {
    const s = e.members[0] ? surname(e.members[0].fullName) : null;
    return s ? { key: `s:${s.toLowerCase()}`, value: s } : null;
  }
  return null;
}

/**
 * Turn a mapped sheet into household rows. Pure: no DB. The `exists` issue is added
 * by the caller once it has looked the emails up.
 */
export function buildRows(sheet: Sheet, mapping: Mapping, answers: Answers, events: EventRef[]): { rows: ImportRow[]; stats: BuildStats } {
  const extracted = extract(sheet, mapping, answers, events);
  const sideMapped = mapping.fields.side !== null;
  const sortedEvents = [...events].sort((a, b) => a.sortOrder - b.sortOrder);

  const defaultGroupBy = mapping.fields.familyName !== null ? `column:${mapping.fields.familyName}`
    : mapping.fields.email !== null ? "email" : "surname";
  const mode = mapping.granularity === "guest"
    ? (typeof answers.groupBy === "string" ? answers.groupBy : defaultGroupBy)
    : "row";

  // group source rows into households, preserving first-seen order
  const groups = new Map<string, { value: string | null; items: Extracted[] }>();
  for (const e of extracted) {
    const g = mode === "row" || mode === "none" ? null : groupKey(e, mode, sheet);
    const key = g ? g.key : `row:${e.row}`;
    const bucket = groups.get(key) ?? { value: g?.value ?? null, items: [] };
    bucket.items.push(e);
    groups.set(key, bucket);
  }

  const rows: ImportRow[] = [];
  const seenEmails = new Set<string>();
  let n = 0;
  for (const { value, items } of groups.values()) {
    const first = items[0];
    const members: Member[] = [];
    const seenNames = new Set<string>();
    for (const it of items) for (const m of it.members) {
      const k = m.fullName.toLowerCase();
      if (!seenNames.has(k)) { seenNames.add(k); members.push(m); }
    }

    let name: string;
    if (mapping.granularity === "family") {
      name = first.familyName || (members[0] ? familyFromMember(members[0].fullName) : "");
    } else if (mode.startsWith("column:")) {
      name = value ? familyFromGroupValue(value) : (members[0]?.fullName ?? "");
    } else if (mode === "surname") {
      name = value ? `${value} Family` : (members[0]?.fullName ?? "");
    } else if (mode === "email") {
      name = members.length > 1 ? familyFromMember(members[0].fullName) : (members[0]?.fullName ?? "");
    } else {
      name = members[0]?.fullName || first.familyName || "";
    }

    const issues: IssueCode[] = [];
    const sideHit = items.map((i) => i.side).find((s) => s !== null) ?? null;
    if (sideMapped && sideHit === null) issues.push("unknown_side");

    const emails = items.map((i) => i.email).filter(Boolean);
    const validEmail = emails.find((e) => EMAIL_RE.test(e));
    const email = validEmail ?? emails[0] ?? "";
    if (!email) issues.push("missing_email");
    else if (!validEmail) issues.push("invalid_email");
    else if (seenEmails.has(email)) issues.push("duplicate_in_sheet");
    if (validEmail) seenEmails.add(validEmail);

    if (!name) issues.push("missing_name");
    if (!members.length) {
      issues.push("no_members");
      if (name) members.push({ fullName: name, ageGroup: "adult" });
    }

    const eventSet = new Set(items.flatMap((i) => i.eventIds));
    const eventIds = sortedEvents.filter((e) => eventSet.has(e.id)).map((e) => e.id);
    if (!eventIds.length) issues.push("no_events");

    rows.push({
      key: `h${++n}`,
      name,
      side: sideHit ?? "both",
      relation: items.map((i) => i.relation).find(Boolean) ?? "",
      email,
      members,
      eventIds,
      issues,
      sourceRows: items.map((i) => i.row),
    });
  }

  const kept = answers.missingEmail === "skip" ? rows.filter((r) => !r.issues.includes("missing_email")) : rows;
  return {
    rows: kept,
    stats: { sourceRows: sheet.rows.length, households: kept.length, withIssues: kept.filter((r) => r.issues.length).length },
  };
}
