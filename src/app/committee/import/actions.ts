"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { aiConfigured } from "@/lib/ai";
import { parseWorkbook, ImportError, MAX_COLS, MAX_ROWS, type Sheet } from "@/lib/import/spreadsheet";
import { profileColumns, type ColumnProfile } from "@/lib/import/profile";
import { heuristicMapping } from "@/lib/import/heuristic";
import { aiMapping } from "@/lib/import/ai";
import { buildQuestions, type EventRef, type Mapping, type Proposal } from "@/lib/import/mapping";
import { buildRows, type BuildStats, type ImportRow } from "@/lib/import/normalize";
import { commitImport, findExistingEmails, type CommitResult } from "@/lib/import/commit";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/* Same rule as the rest of /committee: admin names a wedding, committee is pinned to its own. */
async function scopedWeddingId(requested: string): Promise<string | null> {
  const staff = await requireRole(["committee", "admin"]);
  if (staff.role === "admin") return requested;
  return staff.weddingId;
}

async function weddingEvents(weddingId: string): Promise<EventRef[]> {
  const rows = await db.select({ id: events.id, name: events.name, sortOrder: events.sortOrder })
    .from(events).where(eq(events.weddingId, weddingId)).orderBy(events.sortOrder);
  return rows;
}

export type Analysis = {
  fileName: string;
  sheets: { name: string; rowCount: number }[];
  sheetIndex: number;
  sheet: Sheet;
  profiles: ColumnProfile[];
  proposal: Proposal;
  aiConfigured: boolean;
};

export async function analyzeUpload(formData: FormData): Promise<{ ok: true; analysis: Analysis } | { ok: false; error: string }> {
  const weddingIdRaw = String(formData.get("weddingId") ?? "");
  if (!z.string().uuid().safeParse(weddingIdRaw).success) return { ok: false, error: "invalid input" };
  const weddingId = await scopedWeddingId(weddingIdRaw);
  if (!weddingId) return { ok: false, error: "forbidden" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a spreadsheet first." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "That file is over 4 MB. Export just the guest sheet and try again." };

  let sheets: Sheet[];
  try {
    sheets = parseWorkbook(await file.arrayBuffer(), file.name);
  } catch (e) {
    return { ok: false, error: e instanceof ImportError ? e.message : "Could not read that file." };
  }
  const requestedIndex = Number(formData.get("sheetIndex") ?? 0);
  const sheetIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < sheets.length ? requestedIndex : 0;
  const sheet = sheets[sheetIndex];

  const evs = await weddingEvents(weddingId);
  const profiles = profileColumns(sheet);
  const base = heuristicMapping(profiles, evs);
  let mapping: Mapping = base;
  let notes: string[] = [];
  let engine: Proposal["engine"] = "heuristic";
  if (aiConfigured()) {
    const ai = await aiMapping(profiles, evs, base);
    if (ai) { mapping = ai.mapping; notes = ai.notes; engine = "ai"; }
  }
  const missingEmail = buildRows(sheet, mapping, {}, evs).rows.filter((r) => r.issues.includes("missing_email")).length;
  const questions = buildQuestions(mapping, profiles, evs, missingEmail);

  return {
    ok: true,
    analysis: {
      fileName: file.name,
      sheets: sheets.map((s) => ({ name: s.name, rowCount: s.rows.length })),
      sheetIndex,
      sheet,
      profiles,
      proposal: { mapping, questions, notes, engine },
      aiConfigured: aiConfigured(),
    },
  };
}

const sheetSchema = z.object({
  name: z.string().max(200),
  headerRow: z.number().int().min(0),
  headers: z.array(z.string().max(200)).max(MAX_COLS),
  rows: z.array(z.array(z.string().max(2000)).max(MAX_COLS)).max(MAX_ROWS),
});

const fieldIndex = z.number().int().min(0).max(MAX_COLS - 1).nullable();
const mappingSchema = z.object({
  granularity: z.enum(["family", "guest"]),
  fields: z.object({
    familyName: fieldIndex, guestName: fieldIndex, side: fieldIndex, relation: fieldIndex,
    email: fieldIndex, ageGroup: fieldIndex, headcount: fieldIndex, eventsList: fieldIndex,
  }),
  eventColumns: z.record(z.string().uuid(), fieldIndex),
  confidence: z.record(z.string(), z.number()).optional().default({}),
});

const answersSchema = z.record(z.string().max(40), z.union([z.string().max(200), z.array(z.string().max(200)).max(100)]));

const previewSchema = z.object({
  weddingId: z.string().uuid(),
  sheet: sheetSchema,
  mapping: mappingSchema,
  answers: answersSchema,
});

export async function previewRows(input: unknown): Promise<
  { ok: true; rows: ImportRow[]; stats: BuildStats; existsCount: number } | { ok: false; error: string }
> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const weddingId = await scopedWeddingId(parsed.data.weddingId);
  if (!weddingId) return { ok: false, error: "forbidden" };

  const evs = await weddingEvents(weddingId);
  const { rows, stats } = buildRows(parsed.data.sheet, parsed.data.mapping as Mapping, parsed.data.answers, evs);
  const existing = await findExistingEmails(weddingId);
  let existsCount = 0;
  for (const r of rows) {
    if (r.email && existing.has(r.email.toLowerCase())) { r.issues.push("exists"); existsCount++; }
  }
  return { ok: true, rows, stats: { ...stats, withIssues: rows.filter((r) => r.issues.length).length }, existsCount };
}

const rowSchema = z.object({
  key: z.string().max(40),
  name: z.string().max(120),
  side: z.enum(["bride", "groom", "both"]),
  relation: z.string().max(120),
  email: z.union([z.literal(""), z.string().email().max(254)]),
  members: z.array(z.object({ fullName: z.string().max(120), ageGroup: z.enum(["adult", "child"]) })).max(50),
  eventIds: z.array(z.string().uuid()).max(50),
  issues: z.array(z.string()).optional().default([]),
  sourceRows: z.array(z.number()).optional().default([]),
});

const commitSchema = z.object({
  weddingId: z.string().uuid(),
  onExisting: z.enum(["skip", "update"]),
  rows: z.array(rowSchema).min(1).max(MAX_ROWS),
});

export async function commitRows(input: unknown): Promise<{ ok: true; result: CommitResult } | { ok: false; error: string }> {
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) {
    const bad = parsed.error.issues.find((i) => i.path.includes("email"));
    return { ok: false, error: bad ? "One of the emails isn't valid — fix it or clear it." : "invalid input" };
  }
  const weddingId = await scopedWeddingId(parsed.data.weddingId);
  if (!weddingId) return { ok: false, error: "forbidden" };
  const result = await commitImport(weddingId, parsed.data.rows as ImportRow[], { onExisting: parsed.data.onExisting });
  revalidatePath("/committee");
  return { ok: true, result };
}
