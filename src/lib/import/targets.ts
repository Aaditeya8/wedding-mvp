/**
 * The vocabulary the intake portal maps spreadsheets onto: target fields, header
 * synonyms, and value parsers for the enum-like cells (side, age, yes/no, events).
 * Pure functions — no I/O — so the heuristic, the AI merge and the normaliser
 * all speak the same language and stay testable.
 */

export type TargetField =
  | "familyName" | "guestName" | "side" | "relation" | "email" | "ageGroup" | "headcount" | "eventsList";

export const TARGET_FIELDS: { id: TargetField; label: string; hint: string }[] = [
  { id: "familyName", label: "Household / family", hint: "One invite goes to each household. “Sharma Family”, “Mama's house”." },
  { id: "guestName", label: "Guest name(s)", hint: "A person per row, or several names in one cell separated by commas." },
  { id: "side", label: "Side", hint: "Bride, groom or both. Ladki/ladka wale work too." },
  { id: "relation", label: "Relation", hint: "Free text: “Ananya's mama”, “college friends”." },
  { id: "email", label: "Email", hint: "Where the invite link is sent. One per household." },
  { id: "ageGroup", label: "Adult / child", hint: "A word, or an age in years." },
  { id: "headcount", label: "Number of people", hint: "Used to create placeholder members when names are missing." },
  { id: "eventsList", label: "Events (list in one cell)", hint: "“Sangeet, Reception”. Per-event yes/no columns are detected separately." },
];

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/['’.\-]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Normalised header phrases. Matched whole or as a whole-word phrase inside the header. */
export const HEADER_SYNONYMS: Record<TargetField, string[]> = {
  familyName: ["family", "family name", "household", "house", "group", "family group", "party", "invitee family", "surname", "family head", "head of family", "guest family"],
  guestName: ["name", "names", "guest name", "guest names", "full name", "guest", "guests", "member", "members", "invitee", "invitees", "person", "persons", "attendee", "name of guest", "guest list", "details of persons", "detail of persons", "detail of person", "person details", "names of persons", "guest details", "name of guests", "people names", "who"],
  side: ["side", "bride groom", "bride or groom", "bride groom side", "whose side", "from", "ladki ladka", "team", "guest of", "invited by"],
  relation: ["relation", "relationship", "relation to couple", "how related", "connection", "category", "tag", "type", "group type", "circle"],
  email: ["email", "e mail", "email id", "email address", "mail", "mail id", "emailid", "email ids", "contact email"],
  ageGroup: ["age group", "age", "adult child", "adult or child", "type of guest", "kid", "child", "age category"],
  headcount: ["headcount", "head count", "no of guests", "no of people", "no of persons", "no of person", "nos", "nos of persons", "number", "numbers", "number of guests", "number of people", "count", "pax", "persons", "people", "total", "no of pax", "members count", "qty", "quantity", "seats", "guest count", "total guests", "no of members", "persons count", "guests"],
  eventsList: ["events", "event", "invited to", "invited for", "functions", "function", "ceremonies", "invited events", "attending", "invitation for", "invite for"],
};

const BRIDE = /\b(bride|brides|ladki|dulhan|vadhu|girl|girls|her)\b/;
const GROOM = /\b(groom|grooms|ladka|dulha|var|boy|boys|his)\b/;
const BOTH = /\b(both|common|mutual|dono|shared|joint|neutral|couple|friends of both)\b/;

export function parseSide(raw: string): "bride" | "groom" | "both" | null {
  const s = normalizeHeader(raw);
  if (!s) return null;
  if (s === "b") return "bride";
  if (s === "g") return "groom";
  const isBride = BRIDE.test(s), isGroom = GROOM.test(s);
  if (BOTH.test(s) || (isBride && isGroom)) return "both";
  if (isBride) return "bride";
  if (isGroom) return "groom";
  return null;
}

export function parseAgeGroup(raw: string): "adult" | "child" | null {
  const s = normalizeHeader(raw);
  if (!s) return null;
  if (/\b(child|children|kid|kids|minor|minors|baby|infant|toddler|teen|teenager|bachha|bachche)\b/.test(s)) return "child";
  if (/\b(adult|adults|grown|senior|elder|elders)\b/.test(s)) return "adult";
  if (/^\d{1,3}$/.test(s)) {
    const n = Number(s);
    if (n > 120) return null;
    return n < 18 ? "child" : "adult";
  }
  return null;
}

const TRUE_SET = new Set(["y", "yes", "true", "1", "✓", "✔", "☑", "x", "invited", "attending", "coming", "confirmed", "ok", "present", "haan", "ha", "attend", "going", "in"]);
const FALSE_SET = new Set(["n", "no", "false", "0", "", "-", "—", "–", "na", "n a", "not invited", "declined", "absent", "nahi", "not attending", "not coming", "out", "none", "nil", "null"]);

export function parseBoolean(raw: string): boolean | null {
  const t = raw.trim().toLowerCase();
  if (TRUE_SET.has(t)) return true;
  if (FALSE_SET.has(t)) return false;
  const s = normalizeHeader(t);
  if (TRUE_SET.has(s)) return true;
  if (FALSE_SET.has(s)) return false;
  return null;
}

/** Canonical event families: any token in the list stands for the key. */
const EVENT_GROUPS: Record<string, string[]> = {
  haldi: ["haldi", "pithi", "ubtan"],
  mehendi: ["mehendi", "mehndi", "mehandi", "henna", "mehendhi"],
  sangeet: ["sangeet", "sangeeth", "sangit", "ladies sangeet"],
  pheras: ["pheras", "phera", "phere", "wedding", "shaadi", "shadi", "vivah", "vivaah", "marriage", "muhurat", "muhurtham", "nikah", "lagna", "lagan", "mandap", "saat phere", "kanyadaan", "varmala", "jaimala"],
  reception: ["reception", "walima", "valima"],
  cocktail: ["cocktail", "cocktails", "cocktail party"],
  engagement: ["engagement", "roka", "sagai", "sagan", "ring", "ring ceremony", "misri", "chunni"],
  tilak: ["tilak"],
  baraat: ["baraat", "barat"],
  brunch: ["brunch", "breakfast"],
  puja: ["puja", "pooja", "ganesh puja", "mata ki chowki", "jagrata", "havan"],
};
const STOP = new Set(["night", "function", "event", "ceremony", "day", "evening", "morning", "party", "the", "and", "of", "at", "in", "main"]);

function eventKeys(name: string): Set<string> {
  const norm = normalizeHeader(name);
  const keys = new Set<string>();
  for (const [key, aliases] of Object.entries(EVENT_GROUPS)) {
    if (aliases.some((a) => new RegExp(`\\b${a}\\b`).test(norm))) keys.add(`g:${key}`);
  }
  for (const tok of norm.split(" ")) if (tok && !STOP.has(tok)) keys.add(`t:${tok}`);
  return keys;
}

/** Map a header or cell like "Wedding" / "Mehndi" / "reception (Mumbai)" to one of the wedding's real event names. */
export function matchEventName(raw: string, eventNames: string[]): string | null {
  const norm = normalizeHeader(raw);
  if (!norm) return null;
  const exact = eventNames.find((e) => normalizeHeader(e) === norm);
  if (exact) return exact;
  const rawKeys = eventKeys(raw);
  const groupHit = eventNames.find((e) => [...eventKeys(e)].some((k) => k.startsWith("g:") && rawKeys.has(k)));
  if (groupHit) return groupHit;
  const tokenHit = eventNames.find((e) => [...eventKeys(e)].some((k) => k.startsWith("t:") && rawKeys.has(k)));
  return tokenHit ?? null;
}
