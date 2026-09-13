import { z } from "zod";
import { unzipSync } from "fflate";
import { aiConfigured, chatComplete } from "@/lib/ai";
import { ImportError } from "./spreadsheet";
import { EMAIL_RE } from "./profile";
import type { EventRef } from "./mapping";
import { familyFromMember, padWithPlaceholders, parseMembersCell, type ImportRow, type IssueCode, type Member } from "./normalize";
import { matchEventName, parseSide } from "./targets";

/* ------------------------------------------------------------------ files */

export type Extracted = { kind: "text"; text: string } | { kind: "image"; mime: string };

const IMAGE_MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const UNSUPPORTED = "Upload a photo (JPG/PNG), PDF, Word document (.docx) or text file — or paste the text.";

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function normalizeText(s: string): string {
  return s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}

export function docxToText(xml: string): string {
  const paragraphs = xml.split(/<\/w:p>/);
  const lines: string[] = [];
  for (const p of paragraphs) {
    const withBreaks = p.replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, "\n");
    const runs = [...withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => decodeEntities(m[1]));
    const text = runs.join("").trim();
    if (text) lines.push(text);
  }
  return normalizeText(lines.join("\n"));
}

export async function extractTextFromFile(buf: Uint8Array, filename: string): Promise<Extracted> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (IMAGE_MIME[ext]) return { kind: "image", mime: IMAGE_MIME[ext] };
  if (ext === "txt" || ext === "md" || ext === "text") return { kind: "text", text: normalizeText(new TextDecoder().decode(buf)) };
  if (ext === "docx") {
    let files: Record<string, Uint8Array>;
    try { files = unzipSync(buf); } catch { throw new ImportError(`Could not read ${filename} — is it a Word .docx file?`); }
    const doc = files["word/document.xml"];
    if (!doc) throw new ImportError(`Could not read ${filename} — is it a Word .docx file?`);
    return { kind: "text", text: docxToText(new TextDecoder().decode(doc)) };
  }
  if (ext === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    let text = "";
    try {
      const doc = await getDocumentProxy(new Uint8Array(buf));
      text = (await extractText(doc, { mergePages: true })).text;
    } catch {
      throw new ImportError(`Could not read ${filename} as a PDF.`);
    }
    const clean = normalizeText(text);
    if (!clean) throw new ImportError(`${filename} has no text layer (it's a scan). Upload a photo or screenshot of it instead.`);
    return { kind: "text", text: clean };
  }
  throw new ImportError(UNSUPPORTED);
}

/* ------------------------------------------------------------------ text → households */

export type ScanHousehold = {
  name?: string;
  members: string[];
  headcount?: number;
  side?: "bride" | "groom" | "both";
  relation?: string;
  email?: string;
  /** raw hints like "reception", matched to real events later */
  events?: string[];
  source: string;
};

const JUNK_LINE = /^(guest\s*list|guests?|list|names?|total|count|grand total|sr\.?\s*no|s\.?\s*no|sl\.?\s*no)\b[\s:.-]*\d*$/i;
const ENUMERATOR = /^(?:\(?\d{1,3}[.)\]:]?\s+|[-•*·>]\s+)/;
const SEPARATORS = /,|;|\/|&|\band\b|\n/i;
const FAMILY_LABEL = /\b(family|families|parivar|parivaar|ji|masa|masi|mausi|maushi|mama|mami|chacha|chachu|chachi|kaka|kaki|bua|fufa|tau|tai|taiji|nana|nani|dada|dadi|uncle|aunty|aunt|group|gang|friends|colleagues|office|team|batch|house|home|neighbours|neighbors|cousins|relatives|wale|saheb|sahab)\b/i;
const PLURAL_LABEL = /^the\s+\w+s$/i;
const EVENT_WORD = /\b(haldi|pithi|mehendi|mehndi|mehandi|henna|sangeet|sangeeth|pheras|phera|wedding|shaadi|shadi|vivah|marriage|muhurat|nikah|reception|walima|cocktail|cocktails|engagement|roka|sagai|sagan|tilak|baraat|barat|brunch|puja|pooja|havan)\b/i;
const COUNT_WORDS = "(?:people|persons?|pax|members?|guests?|nos?|ppl|heads?|adults?)";
const AGE_MARKER = /^(child|kid|baby|infant|toddler|minor|\d{1,2}\s*(?:y|yr|yrs|years?|yo)?)$/i;
const INLINE_EMAIL = /[^\s@()<>\[\],;:]+@[^\s@()<>\[\],;:]+\.[a-z0-9-]{2,}/i;

function parseParenthetical(inner: string, h: ScanHousehold): void {
  const t = inner.trim();
  if (!t) return;
  if (EMAIL_RE.test(t)) { h.email = t.toLowerCase(); return; }
  if (/^\d{1,3}$/.test(t)) { h.headcount = Number(t); return; }
  const parts = t.split(/\s*(?:,|&|\+|\band\b|\/)\s*/i).map((p) => p.replace(/\bonly\b/i, "").trim()).filter(Boolean);
  if (parts.length && parts.every((p) => EVENT_WORD.test(p))) {
    h.events = [...(h.events ?? []), ...parts.map((p) => p.toLowerCase())];
    return;
  }
  const side = parseSide(t);
  if (side && t.split(" ").length <= 3) { h.side = side; return; }
  h.relation = h.relation ? `${h.relation}; ${t}` : t;
}

function isSideHeading(line: string): "bride" | "groom" | "both" | null {
  const t = line.replace(/[:\-–]+$/, "").trim();
  if (/\d/.test(t) || /,/.test(t) || t.split(/\s+/).length > 4) return null;
  return parseSide(t);
}

/**
 * Rule-based reading of a pasted or typed list — the WhatsApp message, the notes app,
 * the OCR'd photo. One household per line; section headings set the side.
 */
export function parseGuestText(text: string): ScanHousehold[] {
  const out: ScanHousehold[] = [];
  let side: ScanHousehold["side"];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || JUNK_LINE.test(line)) continue;
    const heading = isSideHeading(line);
    if (heading) { side = heading; continue; }

    const h: ScanHousehold = { members: [], source: line };
    if (side) h.side = side;
    let core = line.replace(ENUMERATOR, "");

    // "(child)" / "(6)" after a name in a list stays with that name; anything else in
    // brackets is metadata for the whole line (email, count, events, side, relation)
    core = core.replace(/\(([^)]*)\)|\[([^\]]*)\]/g, (whole, a, b, offset: number) => {
      const inner = (a ?? b ?? "").trim();
      const listed = SEPARATORS.test(core.slice(0, offset));
      if (AGE_MARKER.test(inner) && (listed || !/^\d+$/.test(inner))) return whole;
      parseParenthetical(inner, h);
      return " ";
    });
    const email = core.match(INLINE_EMAIL);
    if (email) { h.email = email[0].toLowerCase(); core = core.replace(email[0], " "); }
    core = core.replace(/\s+/g, " ").replace(/[\s,;:-]+$/, "").trim();

    let total: number | undefined;
    let plus: number | undefined;
    let m: RegExpMatchArray | null;
    if ((m = core.match(new RegExp(`\\s*[-–—:=]\\s*(\\d{1,3})\\s*${COUNT_WORDS}?\\.?$`, "i")))) { total = Number(m[1]); core = core.slice(0, m.index); }
    else if ((m = core.match(/\s*[x×]\s*(\d{1,3})$/i))) { total = Number(m[1]); core = core.slice(0, m.index); }
    else if ((m = core.match(new RegExp(`\\s*(?:\\+|&|\\band\\b|\\bwith\\b)\\s*(\\d{1,3})\\s*(?:kids?|children|others?|more|${COUNT_WORDS}|family members?)?$`, "i")))) { plus = Number(m[1]); core = core.slice(0, m.index); }
    else if ((m = core.match(new RegExp(`^(\\d{1,3})\\s*${COUNT_WORDS}?\\s*[-–—:]\\s*`, "i")))) { total = Number(m[1]); core = core.slice(m[0].length); }
    core = core.replace(/[\s,;:-]+$/, "").trim();
    if (!core) continue;

    if (core.includes(":")) {
      const [label, rest] = core.split(/:([\s\S]*)/);
      h.name = label.trim();
      h.members = rest.split(SEPARATORS).map((s) => s.trim()).filter(Boolean);
    } else if (SEPARATORS.test(core)) {
      h.members = core.split(SEPARATORS).map((s) => s.trim()).filter(Boolean);
    } else if (FAMILY_LABEL.test(core) || PLURAL_LABEL.test(core) || total !== undefined) {
      h.name = core;
    } else {
      h.members = [core];
    }

    if (total !== undefined) h.headcount = total;
    else if (plus !== undefined) h.headcount = plus + Math.max(h.members.length, 1);
    out.push(h);
  }
  return out;
}

/* ------------------------------------------------------------------ households → rows */

export function householdsToRows(households: ScanHousehold[], events: EventRef[], keyPrefix = "s"): ImportRow[] {
  const sorted = [...events].sort((a, b) => a.sortOrder - b.sortOrder);
  const names = events.map((e) => e.name);
  return households.map((h, i) => {
    let members: Member[] = h.members.flatMap((m) => parseMembersCell(m));
    const name = (h.name ?? (members[0] ? familyFromMember(members[0].fullName) : "")).trim();
    members = padWithPlaceholders(members, h.headcount);

    const hinted = new Set((h.events ?? []).map((e) => matchEventName(e, names)).filter((n): n is string => !!n));
    const eventIds = (hinted.size ? sorted.filter((e) => hinted.has(e.name)) : sorted).map((e) => e.id);

    const email = (h.email ?? "").trim().toLowerCase();
    const issues: IssueCode[] = [];
    if (!name) issues.push("missing_name");
    if (!email) issues.push("missing_email");
    else if (!EMAIL_RE.test(email)) issues.push("invalid_email");
    if (!members.length) { issues.push("no_members"); if (name) members = [{ fullName: name, ageGroup: "adult" }]; }
    if (!eventIds.length) issues.push("no_events");

    return {
      key: `${keyPrefix}${i + 1}`,
      name,
      side: h.side ?? "both",
      relation: (h.relation ?? "").trim(),
      email,
      members,
      eventIds,
      issues,
      sourceRows: [],
    };
  });
}

/* ------------------------------------------------------------------ AI extraction */

const householdSchema = z.object({
  name: z.string().max(200).optional().nullable(),
  members: z.array(z.string().max(200)).max(60).optional().nullable(),
  headcount: z.number().int().min(0).max(500).optional().nullable(),
  side: z.enum(["bride", "groom", "both"]).optional().nullable(),
  relation: z.string().max(200).optional().nullable(),
  email: z.string().max(254).optional().nullable(),
  events: z.array(z.string().max(100)).max(20).optional().nullable(),
});
const extractionSchema = z.object({
  households: z.array(householdSchema).max(1000),
  notes: z.array(z.string()).max(10).optional().nullable(),
});

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}

/**
 * Read a guest list out of free text or photos. Returns null when AI is off or the
 * reply is unusable, so callers fall back to parseGuestText (text) or explain that a
 * photo needs the AI key (images).
 */
export async function aiExtractHouseholds(
  input: { text?: string; images?: string[] },
  events: EventRef[],
  fetchImpl?: typeof fetch,
): Promise<{ households: ScanHousehold[]; notes: string[] } | null> {
  if (!aiConfigured()) return null;
  const system = [
    "You read Indian wedding guest lists — typed, pasted from WhatsApp, or photographed (possibly handwritten) — and return them as JSON.",
    'Reply with one JSON object only: { "households": [ { "name"?: string, "members": string[], "headcount"?: number, "side"?: "bride"|"groom"|"both", "relation"?: string, "email"?: string, "events"?: string[] } ], "notes": string[] }',
    "One household = the people who get one invitation (a family, a couple, a friend group). Keep names exactly as written. Put a family label (“Sharma family”, “Mama ji”) in name; individual people in members; a count like “- 4” or “+3” in headcount (total people).",
    "Section headings such as “Ladki wale”/“Bride side” set side for the entries under them. Hindi/Hinglish is common (ladki wale = bride, ladka wale = groom, shaadi = wedding ceremony, mehndi = mehendi).",
    `Use only these event names in events, when the list mentions them: ${events.map((e) => e.name).join(", ")}. Omit events when unspecified.`,
    "Skip totals, page numbers and headings. Never invent people. Put anything unclear (illegible words, ambiguous counts) in notes, max 5 short items.",
  ].join("\n");
  const user = input.text
    ? `Guest list text:\n\n${input.text.slice(0, 20_000)}`
    : "Read the guest list in the attached photo(s). Transcribe carefully; if a word is illegible, keep your best reading and mention it in notes.";

  let parsed: z.infer<typeof extractionSchema>;
  try {
    const raw = await chatComplete({ system, user, images: input.images, json: true, fetchImpl });
    parsed = extractionSchema.parse(JSON.parse(stripFences(raw)));
  } catch {
    return null;
  }
  const households: ScanHousehold[] = parsed.households
    .map((h) => ({
      name: h.name?.trim() || undefined,
      members: (h.members ?? []).map((m) => m.trim()).filter(Boolean),
      headcount: h.headcount ?? undefined,
      side: h.side ?? undefined,
      relation: h.relation?.trim() || undefined,
      email: h.email?.trim().toLowerCase() || undefined,
      events: (h.events ?? []).map((e) => e.trim()).filter(Boolean),
      source: "ai",
    }))
    .filter((h) => h.name || h.members.length || h.headcount);
  const notes = (parsed.notes ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 5);
  return { households, notes };
}
