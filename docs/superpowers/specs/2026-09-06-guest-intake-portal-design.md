# Guest Intake Portal — Design Spec

**Date:** 2026-09-06
**Status:** Built under stated assumptions (Aadi: "let's get going"); decisions listed in §9 for review
**Branch:** `feat/guest-intake`

## 1. Goal

Get a real customer's guest list into the system without anyone reformatting a spreadsheet.
The committee chooses the path: **upload an Excel/CSV** that the portal scans, understands,
adapts to, and asks about; or **type households in directly**. Both paths end in the same
review grid and the same validated write, so the database never sees a half-imported list.

Production scope from the 2026-07-12 spec listed "CSV guest-list import" as deferred. This is
that item, widened to xlsx and given schema understanding.

## 2. Non-goals

- Editing weddings/events (still seed/admin scope).
- Storing phone numbers or WhatsApp delivery (schema unchanged; such columns map to *ignore*).
- Google Sheets live sync. Export to Excel.
- Streaming or background jobs. Guest lists are hundreds of rows; one request handles it.

## 3. Route and access

`/committee/import` — same access rule as `/committee`: role `committee` pinned to its
wedding, `admin` may pass `?wedding=<id>`. Linked from the `/committee` toolbar ("Import
guest list") and its empty state.

## 4. User flow

```
choose ─┬─ upload ── map (proposal + questions) ── review ── done
        └─ enter ────────────────────────────────── review ── done
```

- **choose**: two cards. "Upload a spreadsheet" / "Type it in".
- **upload**: file input (`.xlsx .xls .csv`, ≤ 4 MB). Submits to `analyzeUpload`.
- **map**: shows sheet picker (if several), "what we understood" (target field → source
  column, confidence pill, engine badge *AI* or *column names*), the model's notes, and the
  generated **questions**. Every proposed mapping is editable. "Preview rows →" calls
  `previewRows`.
- **review**: editable grid, one line per household: name, side, relation, email, members
  (comma-separated, adult/child inferred from "(child)" suffix), invited events as chips,
  issues column. Add row / remove row. Duplicate policy toggle (skip / update existing).
  "Import N households" calls `commitRows`.
- **enter**: jumps straight to review with an empty grid and 3 blank rows.
- **done**: created / updated / skipped counts, link to `/committee`.

The client holds the parsed sheet in memory between steps; the server is stateless. Nothing
is written until `commitRows`.

## 5. Server modules (`src/lib/import/`)

| Module | Responsibility |
|---|---|
| `spreadsheet.ts` | `parseWorkbook(buffer, filename) → Sheet[]` via SheetJS. Detect header row (first row with ≥ 2 non-empty cells, ≥ 60 % non-numeric, followed by data). Cells → trimmed strings, dates → ISO. Caps: 2 000 rows, 60 columns. |
| `profile.ts` | `profileColumns(sheet) → ColumnProfile[]`: header, 5 distinct samples, fill rate, distinct count, kind (`email·phone·number·boolean·text·empty`). |
| `targets.ts` | The target schema and synonym tables: `familyName, guestName, side, relation, email, ageGroup, headcount, eventsList`, plus per-event boolean columns. Side/age/boolean value synonyms incl. Hindi transliterations (ladki/ladka, dulhan/dulha, vadhu/var, "bride's", "B/G", dono/both/common). Event synonyms (wedding/shaadi/vivah → Pheras; mehndi/henna → Mehendi; …) matched against the wedding's real event names. |
| `heuristic.ts` | `heuristicProposal(profiles, events) → Proposal`. Header-synonym match + value-kind checks. Row granularity: *guest* when a column looks like individual names and a family/group column exists, or when name column has ≥ 2 rows per email. Generates questions from gaps (§6). |
| `ai.ts` | `aiProposal(profiles, events, base) → Proposal | null`. Prompt = column profiles + target descriptions + event names + the heuristic guess. JSON mode, zod-validated, merged over the heuristic (AI wins per field where it names a column; `null` means "not present"). Returns `null` on no key / timeout / invalid JSON → caller keeps heuristic. Notes surface in the UI. |
| `normalize.ts` | `buildRows(sheet, mapping, answers, events) → { rows, stats }`. Grouping of per-guest rows (by column / email / surname / none), name splitting (`,` `;` `&` `and` newline), side/age/boolean mapping, events from per-event columns or list column or default answer, placeholder members from headcount, dedupe within sheet by email (merge members). Issues per row: `missing_name, missing_email, invalid_email, unknown_side, no_members, no_events, duplicate_in_sheet, exists`. |
| `commit.ts` | `commitImport(weddingId, rows, { onExisting })`. Validates event ids belong to the wedding. Existing = same email (case-insensitive) in this wedding: skip or update (replace members + invites, like `upsertFamily`). Sequential inserts (neon-http has no interactive transactions); returns `{ created, updated, skipped, errors[] }`. |
| `../ai.ts` | `chatComplete({ system, user, json: true })` — one seam over any OpenAI-compatible endpoint. Env: `AI_API_KEY`, `AI_BASE_URL` (default `https://api.groq.com/openai/v1`), `AI_MODEL` (default `openai/gpt-oss-120b`). `reasoning_effort: "low"` when the model id contains `gpt-oss`. 20 s timeout. |

## 6. The questions the portal asks

Generated deterministically from the (merged) proposal so they are the same with or without AI:

| id | When | Options (default first) |
|---|---|---|
| `granularity` | always | one household per row / one person per row |
| `groupBy` | granularity = person | the detected family/group column / same email / same surname / each row is its own household |
| `events` | no per-event columns and no events-list column | all events / main events (last three by sort order) / choose… (multi-select) |
| `missingEmail` | ≥ 1 row lacks email | import anyway, add emails later / skip those rows |
| `onExisting` | preview finds matches in DB | skip them / update them |

Answers travel as a plain `Record<string, string | string[]>` and are zod-validated server-side.

## 7. Server actions (`src/app/committee/import/actions.ts`)

All three re-resolve the wedding through `requireRole(["committee","admin"])` exactly like the
existing committee actions, and validate inputs with zod.

- `analyzeUpload(formData)` → `{ file, sheets: [{name, rows}], sheetIndex, profiles, proposal, engine, notes }`.
- `previewRows({ weddingId, sheet, mapping, answers })` → `{ rows, stats, questions }` (adds `exists` flags from DB and the `onExisting` question).
- `commitRows({ weddingId, rows, onExisting })` → `{ created, updated, skipped, errors }`. Also used by the direct-entry path.

`next.config.ts`: `experimental.serverActions.bodySizeLimit = "4mb"`.

## 8. Related changes

- `issueInvites`: families with an empty email are skipped with `error: "no email"` instead of
  handing an empty recipient to the mailer.
- `/committee`: "Import guest list" button; empty state mentions import; families with no
  email show a "no email" badge.
- `.env.example`, README, `docs/HOW-IT-WORKS.md` §8 document the AI variables.

## 9. Decisions made without Aadi (revisit if wrong)

1. **AI provider = any OpenAI-compatible endpoint, Groq by default.** ₹0/month constraint and
   every other founder project already runs on Groq. Swapping to Anthropic/OpenAI is one env
   change; the seam is 40 lines.
2. **Only headers + 5 sample cells per column go to the model**, never the whole sheet.
   Guest names and emails are personal data; the model doesn't need them to map columns.
3. **Heuristic first, AI refines.** The portal works with no key, and a model outage degrades
   to "matched by column names" instead of failing the upload.
4. **Rows without email are importable** (flagged). Indian lists are often WhatsApp-first;
   blocking on email would block the import. Invites to such families are skipped with a
   clear error until an email is added.
5. **Duplicate = same email within the wedding.** Name matching is too fuzzy for households
   ("Sharma Family" ×3). Skip is the default; update is opt-in.
6. **Direct entry = the same review grid**, not a new form. One validated write path.

## 10. Testing

Vitest, under `tests/unit/import/`:

- `spreadsheet`: csv + xlsx round-trip (workbook built in-test), header row under title rows, date cells, caps.
- `profile`: kinds and fill rate.
- `heuristic`: a typical Indian planner sheet (`S.No, Guest Name, Family, Side, Relation, Email, Mobile, Haldi, Sangeet, Wedding, Reception`) maps fully; a per-family sheet with a "Names" cell; a sheet with an "Events" list column; questions generated correctly.
- `ai`: fake `fetch` → merge; malformed JSON → null; missing key → null; `reasoning_effort` sent for gpt-oss.
- `normalize`: grouping by column/email/surname, name splitting, side/age synonyms, per-event booleans, events list fuzzy match, headcount placeholders, in-sheet duplicates, issue codes.
- `commit`: PGlite in-memory — create; skip vs update existing; foreign event id rejected; empty email round-trips.
- `invites`: empty email skipped.

Browser verification with a sample `.xlsx` through the full wizard, plus the direct-entry path.

---

## Addendum (same day): real list, incremental adds, scanning documents

**Trigger.** Aadi supplied a real customer list (a hotel room allocation sheet: family name
on the first row of a block, one person per row below, `Nos` = headcount, a misspelt
"Detai of Oersons" column, no emails/sides/events) and asked for "scanning written/docs
with incremental data to keep adding without duplication".

### A. Spreadsheet path changes
- **Fill-down grouping.** New question `fillDown` (asked when the family column is < 70 %
  filled; default *yes* below 50 %): a blank family cell continues the family above.
- **Fuzzy headers.** One typo per word of 4+ letters, two per word of 7+ ("oersons" ≈
  "persons"). Score 0.7, shown as "probably".
- **Name-column fallback.** When no header names the guests, the fullest, most varied unused
  text column is proposed (confidence 0.5).
- **Headcount padding.** In both granularities a group's headcount (`Nos`, `No. of people`)
  pads members with `Guest N` placeholders. Rows with every mapped cell blank are dropped
  and counted (`stats.emptyRows`).
- `headcount` synonyms gain `nos`, `number`, `guests`; `guestName` gains `persons`,
  `details of persons`, `who`.

### B. Duplicate detection and merge (`src/lib/import/match.ts`, `commit.ts`)
- A row matches an existing household by **email**, else by **normalised name** (drops
  the/family/parivar/house/ji/&, possessives, plural s), else by **member overlap** (≥ 50 %
  of the smaller side, placeholders ignored). Two rows that both carry emails, and
  different ones, never match by name or people.
- `onExisting`: `skip` | `update` | **`merge`** (default). Merge adds unseen people (no
  placeholders), unions event invites, fills blank email/relation, never removes. Newly
  inserted rows join the match pool so a household repeated within one batch is handled
  the same way. Re-importing an identical list → created 0, updated N.
- Typed-in rows are checked (`checkRows`) on the first Import click; matches surface the
  choice panel before anything is written.

### C. Scan path (`src/lib/import/scan.ts`, `extractDocument`)
- Inputs: JPG/PNG/WEBP/GIF (vision), PDF (text layer via `unpdf`; scans are rejected with
  advice to photograph), DOCX (`fflate` unzip → `word/document.xml` paragraphs), TXT, or
  pasted text. ≤ 6 MB; server-action body limit raised to 8 MB.
- `parseGuestText` (rule-based, always runs): enumerators, side headings (Ladki wale /
  Groom side), counts (`- 4`, `x5`, `+3`, `& 2 kids`, `(4)`), `Label: a, b, c`, comma
  lists, bare names, emails, parenthetical events/relation/side, junk lines (totals,
  headings). `(child)` / `(6)` after a listed name stays an age marker.
- `aiExtractHouseholds`: same JSON shape from the model; text → `AI_MODEL`, images →
  `AI_VISION_MODEL` (default `meta-llama/llama-4-scout-17b-16e-instruct` on Groq, sent as
  OpenAI `image_url` content parts). Falls back to the rules for text; photos without a key
  are refused with a clear message.
- `householdsToRows` → the same review grid; the engine badge and the model's notes are
  shown above it, with the extracted text on request.

### D. Privacy
The real list stays outside the repo (`var/` is gitignored; the browser test used a copy
there). No guest names appear in docs, commits, or tests — fixtures are invented.
