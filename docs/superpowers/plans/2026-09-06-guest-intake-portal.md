# Guest Intake Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/committee/import` portal that ingests a guest list from an uploaded xlsx/xls/csv (schema detected, AI-or-heuristic column mapping, clarifying questions, editable review) or from direct entry, and writes families/guests/event invites through one validated commit path.

**Architecture:** Pure server-side library under `src/lib/import/` (parse → profile → propose → normalize → commit), three server actions that wrap it with auth + zod, and a client wizard with four steps. The client holds the parsed sheet between steps; the server is stateless until the final commit.

**Tech Stack:** Next.js 16 server actions, SheetJS `xlsx` 0.20.3 (CDN tarball), zod 4, Drizzle + PGlite/Neon, one `fetch`-based OpenAI-compatible chat seam (Groq default), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-guest-intake-portal-design.md`

## Global Constraints

- Next.js 16: read `node_modules/next/dist/docs/` before using an API; `searchParams` is a Promise.
- Every server action re-resolves the wedding via `requireRole(["committee","admin"])` and zod-validates input.
- No transactions (neon-http lacks them); sequential writes, report partial failures.
- Only column headers + ≤ 5 sample cells per column may be sent to the AI.
- Caps: 2 000 data rows, 60 columns, 4 MB upload.
- Tests live in `tests/unit/import/`; vitest runs files serially; DB tests use the in-memory PGlite (`VITEST` env) and call `migrateDb()` in `beforeAll`.
- No Claude attribution in commits beyond the session trailer.

---

### Task 1: Spreadsheet parsing

**Files:** Create `src/lib/import/spreadsheet.ts`, `tests/unit/import/spreadsheet.test.ts`

**Interfaces — produces:**
```ts
export type Sheet = { name: string; headerRow: number; headers: string[]; rows: string[][] };
export const MAX_ROWS = 2000; export const MAX_COLS = 60;
export function parseWorkbook(buffer: ArrayBuffer | Uint8Array, filename: string): Sheet[];
export function detectHeaderRow(matrix: string[][]): number;   // exported for tests
```
Rules: cells → trimmed strings; numbers via `String`; dates → `YYYY-MM-DD` (use `cellDates: true`, `raw: false`); skip fully empty rows; drop sheets with no data rows; header = first row with ≥ 2 non-empty cells where ≥ 60 % of non-empty cells are non-numeric and the next non-empty row exists; headers de-duplicated (`Name`, `Name (2)`), blank header → `Column C` (letter).

- [ ] Tests: csv buffer parses to one sheet with headers/rows; xlsx built via `XLSX.utils.aoa_to_sheet` + `XLSX.write({type:"array"})` round-trips including a title row above the header (headerRow = 2) and a Date cell → `2026-11-20`; empty sheet dropped; > MAX_ROWS truncated; duplicate/blank headers renamed.
- [ ] Implement; `npx vitest run tests/unit/import/spreadsheet.test.ts`; commit.

### Task 2: Column profiling + target vocabulary

**Files:** Create `src/lib/import/profile.ts`, `src/lib/import/targets.ts`, `tests/unit/import/profile.test.ts`

**Interfaces — produces:**
```ts
// profile.ts
export type ColumnKind = "email" | "phone" | "number" | "boolean" | "text" | "empty";
export type ColumnProfile = { index: number; header: string; samples: string[]; fillRate: number; distinct: number; kind: ColumnKind };
export function profileColumns(sheet: Sheet): ColumnProfile[];
// targets.ts
export type TargetField = "familyName" | "guestName" | "side" | "relation" | "email" | "ageGroup" | "headcount" | "eventsList";
export const TARGET_FIELDS: { id: TargetField; label: string; hint: string }[];
export const HEADER_SYNONYMS: Record<TargetField, string[]>;
export function parseSide(raw: string): "bride" | "groom" | "both" | null;
export function parseAgeGroup(raw: string): "adult" | "child" | null;   // ages < 18 → child
export function parseBoolean(raw: string): boolean | null;
export function matchEventName(raw: string, eventNames: string[]): string | null; // synonym + token match, returns the real event name
export function normalizeHeader(h: string): string;   // lowercase, strip punctuation/whitespace
```
Kind rules: `email` if ≥ 60 % of non-empty match an email regex; `phone` if ≥ 60 % match `/^[+\d][\d\s().-]{7,}$/`; `boolean` if all non-empty ∈ yes/no/y/n/true/false/1/0/✓/x/–; `number` if all numeric; `empty` if fillRate 0.

- [ ] Tests: kinds for each rule; `parseSide` on `Bride, B, Ladki wale, Dulha, groom's side, Both/Common`; `parseAgeGroup("7")` → child; `parseBoolean("✓")`; `matchEventName("Wedding", ["Haldi","Pheras","Reception"])` → `Pheras`, `"Mehndi"` → `Mehendi`, unknown → null.
- [ ] Implement; run; commit.

### Task 3: Heuristic proposal + questions

**Files:** Create `src/lib/import/mapping.ts` (types + `buildQuestions`), `src/lib/import/heuristic.ts`, `tests/unit/import/heuristic.test.ts`

**Interfaces — produces:**
```ts
// mapping.ts
export type Mapping = {
  granularity: "family" | "guest";
  fields: Partial<Record<TargetField, number | null>>;      // column index
  eventColumns: Record<string, number | null>;               // eventId → boolean column
  confidence: Partial<Record<TargetField, number>>;          // 0..1, display only
};
export type Question = { id: "granularity" | "groupBy" | "events" | "missingEmail" | "onExisting"; text: string; multi?: boolean; options: { value: string; label: string }[]; default: string | string[] };
export type Answers = Record<string, string | string[]>;
export type Proposal = { mapping: Mapping; questions: Question[]; notes: string[]; engine: "heuristic" | "ai" };
export type EventRef = { id: string; name: string; sortOrder: number };
export function buildQuestions(mapping: Mapping, profiles: ColumnProfile[], events: EventRef[], missingEmailCount: number): Question[];
// heuristic.ts
export function heuristicMapping(profiles: ColumnProfile[], events: EventRef[]): Mapping;
```
Heuristics: header synonym → field (first match wins, index columns like "S.No" ignored); if no header match, `kind === "email"` → email; per-event columns by `matchEventName(header)` when kind boolean or the header names an event; granularity `guest` when a `guestName` column exists and (`familyName` also exists or the email column repeats ≥ 2×); confidence 0.9 header match, 0.6 kind match.

- [ ] Tests: planner sheet `S.No, Guest Name, Family, Side, Relation, Email, Mobile, Haldi, Sangeet, Wedding, Reception` → guest granularity, all fields, 4 event columns; family sheet `Family, Names, Bride/Groom, Email ID, Events` → family granularity, eventsList; no events anywhere → `events` question with all/main/choose; per-guest → `groupBy` question defaults to the family column.
- [ ] Implement; run; commit.

### Task 4: AI seam + AI proposal

**Files:** Create `src/lib/ai.ts`, `src/lib/import/ai.ts`, `tests/unit/import/ai.test.ts`; modify `.env.example`

**Interfaces — produces:**
```ts
// lib/ai.ts
export function aiConfigured(): boolean;
export async function chatComplete(args: { system: string; user: string; json?: boolean; timeoutMs?: number; fetchImpl?: typeof fetch }): Promise<string>;
// lib/import/ai.ts
export async function aiMapping(profiles: ColumnProfile[], events: EventRef[], base: Mapping, fetchImpl?: typeof fetch): Promise<{ mapping: Mapping; notes: string[] } | null>;
export function buildPrompt(profiles, events, base): { system: string; user: string };  // exported for tests
```
Model reply schema (zod): `{ granularity, fields: Record<TargetField, number|null>, eventColumns: Record<eventName, number|null>, notes: string[] }`. Merge: AI field value overrides base when it is a valid index or explicit null; unknown event names ignored; confidence 0.8 for AI-set fields.

- [ ] Tests: `aiMapping` with fake fetch returning a good JSON → merged, notes kept; returns null when `AI_API_KEY` unset; null on malformed JSON; request body carries `response_format: {type:"json_object"}` and `reasoning_effort: "low"` for a gpt-oss model id; prompt contains headers + samples but not more than 5 samples per column.
- [ ] Implement; run; commit.

### Task 5: Row normalisation

**Files:** Create `src/lib/import/normalize.ts`, `tests/unit/import/normalize.test.ts`

**Interfaces — produces:**
```ts
export type IssueCode = "missing_name" | "missing_email" | "invalid_email" | "unknown_side" | "no_members" | "no_events" | "duplicate_in_sheet" | "exists";
export type ImportRow = { key: string; name: string; side: "bride"|"groom"|"both"; relation: string; email: string; members: { fullName: string; ageGroup: "adult"|"child" }[]; eventIds: string[]; issues: IssueCode[]; sourceRows: number[] };
export function buildRows(sheet: Sheet, mapping: Mapping, answers: Answers, events: EventRef[]): { rows: ImportRow[]; stats: { sourceRows: number; households: number; withIssues: number } };
export function splitNames(cell: string): string[];
export function parseMembersCell(cell: string): { fullName: string; ageGroup: "adult"|"child" }[];  // "Riya (child)" → child
```
Rules: guest granularity groups by `answers.groupBy` ∈ `column:<i>` | `email` | `surname` | `none`; family name for grouped rows = group value (column) or `<Surname> Family`; side = first non-null in group else `both` + `unknown_side`; events from `eventColumns` booleans, else `eventsList` via `matchEventName`, else `answers.events` (`all` | `main` | list of ids); `headcount` with no names → `Guest 1..N`; no members at all → family name as sole member + `no_members`; `missingEmail === "skip"` drops those rows; duplicate email in sheet → merged into first, `duplicate_in_sheet` on it.

- [ ] Tests: per-guest rows grouped by column with members merged; grouped by email; grouped by surname; family rows with `Names` cell split on `,`/`&`/`and`; side synonyms; per-event booleans; events list fuzzy; default events all/main/list; headcount placeholders; missing email kept vs skipped; duplicate merge; issues list.
- [ ] Implement; run; commit.

### Task 6: Commit path + invites guard

**Files:** Create `src/lib/import/commit.ts`, `tests/unit/import/commit.test.ts`; modify `src/lib/invites.ts`, `tests/unit/invites.test.ts`

**Interfaces — produces:**
```ts
export type CommitOptions = { onExisting: "skip" | "update" };
export type CommitResult = { created: number; updated: number; skipped: number; errors: { key: string; error: string }[] };
export async function findExistingEmails(weddingId: string): Promise<Map<string, string>>;   // lower(email) → familyId
export async function commitImport(weddingId: string, rows: ImportRow[], opts: CommitOptions): Promise<CommitResult>;
```
Per row: name required else error; event ids ⊂ wedding's events else error; existing (email match) → skip or update (update = replace name/side/relation, delete+reinsert guests and invites); insert families → guests → eventInvites.

- [ ] Tests (PGlite): creates 2 families with members + invites; second run skips both; `update` replaces members; foreign event id → error entry, others still created; empty email row is created.
- [ ] `issueInvites` skips `family.email === ""` with `error: "no email"` (test in invites.test.ts).
- [ ] Implement; run full `npm test`; commit.

### Task 7: Server actions + config

**Files:** Create `src/app/committee/import/actions.ts`; modify `next.config.ts` (`experimental.serverActions.bodySizeLimit: "4mb"`)

**Interfaces — produces:**
```ts
export async function analyzeUpload(formData: FormData): Promise<{ ok: true; fileName: string; sheets: Sheet[]; sheetIndex: number; profiles: ColumnProfile[]; proposal: Proposal } | { ok: false; error: string }>;
export async function previewRows(input: unknown): Promise<{ ok: true; rows: ImportRow[]; stats; questions: Question[] } | { ok: false; error: string }>;
export async function commitRows(input: unknown): Promise<{ ok: true; result: CommitResult } | { ok: false; error: string }>;
```
`analyzeUpload` fields: `weddingId`, `file`, optional `sheetIndex`. Runs heuristic, then `aiMapping` when configured, then `buildQuestions`. `previewRows` zod-validates `{weddingId, sheet, mapping, answers}`, runs `buildRows`, marks `exists` via `findExistingEmails`, appends the `onExisting` question when any exist. `commitRows` validates `{weddingId, rows, onExisting}` with the same shape as `familySchema` (name ≤ 120, members ≤ 20 → allow ≤ 50 for imports, email `""` or valid).

- [ ] Implement; `npx tsc --noEmit`; commit.

### Task 8: Wizard UI

**Files:** Create `src/app/committee/import/page.tsx`, `ImportWizard.tsx`, `UploadStep.tsx`, `MappingStep.tsx`, `ReviewGrid.tsx`; modify `src/app/committee/FamilyTable.tsx` (button + empty state + "no email" badge), `src/app/globals.css` (a few `portal-*` additions if needed)

- `page.tsx`: server; same wedding resolution as `committee/page.tsx`; passes `weddingId`, `events` (`id,name,sortOrder`), wedding names.
- `ImportWizard`: `step: "choose"|"upload"|"map"|"review"|"done"`; holds `analysis`, `mapping`, `answers`, `rows`, `onExisting`, `result`.
- `UploadStep`: `<form>` with file input + hidden weddingId → `analyzeUpload` in a transition; shows spinner "Reading your sheet…".
- `MappingStep`: sheet select; engine badge; for each `TARGET_FIELDS` a `<select>` of columns (+ "not in sheet") with confidence pill; per-event selects; notes list; questions rendered as radio groups (checkbox group when `multi`); 5-row sample table; "Preview rows →".
- `ReviewGrid`: table with inline inputs (name, side select, relation, email, members text via `parseMembersCell` on blur — import the pure helper, events chip toggles), issue badges, remove row, "+ add household", counts, `onExisting` toggle when relevant, "Import N households".
- Direct entry: `choose` → `review` with 3 empty rows.
- Done: counts + "Back to guest operations" link + errors list.

- [ ] Implement; `npm run build`; browser-verify both paths with a sample xlsx (`var/sample-guests.xlsx` generated by a one-off script) ; commit.

### Task 9: Docs + wrap-up

**Files:** modify `README.md` (feature bullet, env rows, test count), `docs/HOW-IT-WORKS.md` §8 (verify accuracy), `STATUS.md` (new dated entry)

- [ ] Update; `npm test`, `npx tsc --noEmit`, `npm run build`; commit.
