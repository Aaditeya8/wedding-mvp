import { z } from "zod";
import { aiConfigured, chatComplete } from "@/lib/ai";
import type { ColumnProfile } from "./profile";
import type { EventRef, Mapping } from "./mapping";
import { TARGET_FIELDS, matchEventName, type TargetField } from "./targets";

const FIELD_IDS = TARGET_FIELDS.map((f) => f.id) as [TargetField, ...TargetField[]];

const replySchema = z.object({
  granularity: z.enum(["family", "guest"]).optional(),
  fields: z.record(z.string(), z.number().int().nullable()).optional(),
  eventColumns: z.record(z.string(), z.number().int().nullable()).optional(),
  notes: z.array(z.string()).optional(),
});

/**
 * Only column metadata leaves the server: header, detected kind, fill rate and up to
 * five sample cells. Never the sheet itself.
 */
export function buildPrompt(profiles: ColumnProfile[], events: EventRef[], base: Mapping): { system: string; user: string } {
  const system = [
    "You map the columns of an Indian wedding guest-list spreadsheet onto a fixed schema.",
    "Reply with a single JSON object and nothing else. Schema:",
    '{ "granularity": "family" | "guest",',
    '  "fields": { <targetFieldId>: <columnIndex or null>, ... },',
    '  "eventColumns": { <exact event name>: <columnIndex or null>, ... },',
    '  "notes": [ <short observations a wedding planner would find useful, max 5> ] }',
    "Rules: a column index may appear at most once. Use null for a target that is not in the sheet.",
    '"granularity" is "guest" when each row is one person, "family" when each row is one household (several names in one cell, or a headcount).',
    '"eventColumns" are yes/no columns for a specific event; a column listing several events in one cell is "eventsList".',
    "Phone numbers, WhatsApp numbers, cities and serial numbers have no target — leave them unmapped.",
    "Hindi/Hinglish labels are common: ladki wale = bride side, ladka wale = groom side, shaadi/vivah = the wedding ceremony (pheras), mehndi = mehendi.",
  ].join("\n");

  const byName = (i: number | null) => (i === null ? null : profiles[i]?.header ?? null);
  const guess = {
    granularity: base.granularity,
    fields: Object.fromEntries(FIELD_IDS.map((f) => [f, byName(base.fields[f])])),
    eventColumns: Object.fromEntries(
      Object.entries(base.eventColumns).map(([id, i]) => [events.find((e) => e.id === id)?.name ?? id, byName(i)]),
    ),
  };

  const user = JSON.stringify(
    {
      columns: profiles.map((p) => ({
        index: p.index, header: p.header, kind: p.kind,
        fillRate: Math.round(p.fillRate * 100) / 100, samples: p.samples.slice(0, 5),
      })),
      targets: TARGET_FIELDS.map((f) => ({ id: f.id, label: f.label, hint: f.hint })),
      events: events.map((e) => e.name),
      ruleBasedGuess: guess,
    },
    null,
    1,
  );
  return { system, user };
}

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}

/**
 * Ask the model to refine the heuristic mapping. Returns null whenever it can't help
 * (no key, timeout, bad JSON) so the caller simply keeps the heuristic.
 */
export async function aiMapping(
  profiles: ColumnProfile[],
  events: EventRef[],
  base: Mapping,
  fetchImpl?: typeof fetch,
): Promise<{ mapping: Mapping; notes: string[] } | null> {
  if (!aiConfigured()) return null;
  let parsed: z.infer<typeof replySchema>;
  try {
    const { system, user } = buildPrompt(profiles, events, base);
    const raw = await chatComplete({ system, user, json: true, fetchImpl });
    parsed = replySchema.parse(JSON.parse(stripFences(raw)));
  } catch {
    return null;
  }

  const validIndex = (i: unknown): i is number => typeof i === "number" && Number.isInteger(i) && i >= 0 && i < profiles.length;
  const mapping: Mapping = {
    granularity: parsed.granularity ?? base.granularity,
    fields: { ...base.fields },
    eventColumns: { ...base.eventColumns },
    confidence: { ...base.confidence },
  };

  const taken = new Set<number>();
  for (const f of FIELD_IDS) {
    const v = parsed.fields?.[f];
    if (v === undefined) continue;
    if (v === null) { mapping.fields[f] = null; delete mapping.confidence[f]; continue; }
    if (!validIndex(v) || taken.has(v)) continue;
    mapping.fields[f] = v;
    mapping.confidence[f] = 0.8;
    taken.add(v);
  }
  for (const [name, v] of Object.entries(parsed.eventColumns ?? {})) {
    const ev = events.find((e) => e.name === name) ?? (() => {
      const m = matchEventName(name, events.map((e) => e.name));
      return m ? events.find((e) => e.name === m) : undefined;
    })();
    if (!ev) continue;
    if (v === null) { mapping.eventColumns[ev.id] = null; continue; }
    if (validIndex(v)) mapping.eventColumns[ev.id] = v;
  }
  // an index the model gave to a field can't also be an event column
  for (const [id, i] of Object.entries(mapping.eventColumns)) if (i !== null && taken.has(i)) mapping.eventColumns[id] = null;

  const notes = (parsed.notes ?? []).filter((n) => typeof n === "string" && n.trim()).slice(0, 5).map((n) => n.trim().slice(0, 300));
  return { mapping, notes };
}
