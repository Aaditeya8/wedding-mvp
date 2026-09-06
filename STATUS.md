# Status — 6 September 2026

## Guest intake portal (`feat/guest-intake`, verified in browser, all suites green)

- **`/committee/import`**: two paths, one write. *Upload* (xlsx/xls/csv, ≤ 4 MB) → header-row
  detection, per-column profiling (kind, fill rate, 5 samples) → mapping proposal → the
  questions the sheet can't answer (household vs person per row, how to group, default
  events, missing emails) → editable review grid with flags → import. *Type it in* opens
  the same grid empty. Nothing is written until the final click.
- **Two matching engines.** `heuristic.ts` (header synonyms incl. Hindi/Hinglish, value
  kinds, per-event yes/no columns, "Wedding"→Pheras / "Mehndi"→Mehendi) always runs;
  `ai.ts` refines it over an OpenAI-compatible seam (`src/lib/ai.ts`, Groq + gpt-oss-120b
  by default, `AI_API_KEY` to enable) and only ever sees headers + ≤ 5 samples per column.
  No key or a bad reply → heuristic result, badge says so.
- **Commit rules**: duplicate = same email within the wedding (skip by default, update
  opt-in); rows without email are importable and flagged; `issueInvites` now skips
  email-less households with `error: "no email"`. Default sheet = the one with the most
  cells (workbooks open with cover sheets).
- **Docs**: `docs/HOW-IT-WORKS.md` (plain-language guide for non-devs), spec + plan under
  `docs/superpowers/`, README + `.env.example` updated.
- Validation: 71 unit ✅ (52 new under `tests/unit/import/`), tsc ✅, build ✅, browser pass
  on port 3001 — 15-row per-guest planner sheet → 7 households (6 added, 1 skipped as
  existing), family-per-row CSV through the pipeline, direct entry of one household.
  Sample sheets: `var/sample-guests.xlsx`, `var/sample-families.csv`.
- ⚠️ AI path exercised only with a fake provider in tests — set `AI_API_KEY` in `.env`
  and re-upload `var/sample-guests.xlsx` to see the "Matched by AI" badge and notes.

# Status — 2 August 2026

## Story + ampersand pass (later same day)

- **Our Story rebuilt** (all sites/themes): the sentence-per-"chapter" carousel +
  `::first-letter` drop cap produced awkward fragments ("M | atched by an aunty…").
  Replaced with a single large display-face passage with a hanging accent quote mark
  (`.story-passage/.story-quote/.story-text`); `HowWeMetCarousel.tsx` deleted.
- **Hero ampersand fixed**: (1) `.foil` and `.ltr` both set the `animation` shorthand —
  `.foil` (later in file) was killing the letter-cascade entrance; new `.foil.ltr` rule
  runs both (and is listed in the reduced-motion kill list — two-class specificity
  beats the single-class `animation: none`). (2) Italic swash was clipped because
  `background-clip: text` paints nothing outside the box — `.foil` now pads and
  negative-margins (0.15em/0.2em) so the overhang is covered.
- Roles fix (earlier): `requireRole` now redirects wrong-role visitors to their own
  dashboard instead of throwing `Error("forbidden")` (couple opening /admin crashed).
- Validation: 19 unit ✅ build ✅ + browser pass (ivory + mehfil-noor story, ampersand).

## Multi-wedding + mailroom pass (verified in browser, all suites green)

- **Second wedding seeded**: `gaurav-weds-karishma` (Karishma & Gaurav, 11 Dec 2026,
  Delhi/Udaipur, 6 families, default theme `pichwai-bagh`, couple login
  `SEED_STAFF_EMAILS[4]`). Seed now owns both weddings idempotently.
- **Three new themes** (enum + migration `0002_new-themes.sql`, tokens, ornaments,
  email palettes, switcher): `mehfil-noor` (midnight/silver/gold, Marcellus, chandbali
  crescent, inverted moonlight RSVP band), `pichwai-bagh` (emerald/lotus/gold, Rozha One,
  stroke-drawn lotus), `neel-chhapa` (porcelain/indigo/madder, Prata, hand-stamped bootis).
  Theme metadata centralised in `src/themes/catalog.ts`; ThemeSwitcher/zod/set-theme read it.
- **`/admin/mailroom`**: outbox viewer (sign-in + invite mails, one-click open links,
  timestamps now written to `mail.jsonl`) + DB delivery log. Linked from /admin.
- **Bugs fixed**: root `/` was still create-next-app boilerplate → redirects to demo site;
  Hero hardcoded "Mumbai" → city derived from the Pheras event address; TravelStay showed
  Mumbai hotels on every wedding → per-slug content map; `set-theme.ts` took no slug and
  leaked the PGlite handle.
- **e2e readiness fix**: `playwright.config.ts` polls `/favicon.ico` — `/` now redirects
  into a DB-backed route, and hammering PGlite during first compile aborted the instance.
- Validation: 19 unit ✅ build ✅ e2e ✅ + browser pass over all 3 new themes, both sites,
  6-swatch switcher, mailroom, fresh invite send (The Bedis) and its RSVP link.

# Status — 12 July 2026

## Evening pass (GPT-assisted, verified in browser)

- **"How we met" carousel** replaces the static story block: chapters from the saved
  story, 6.5s auto-advance, pause on hover/focus, dots + arrows + swipe, progress bar,
  reduced-motion aware (`sections/HowWeMetCarousel.tsx`). Confirmed themed correctly.
- **Staff UI restyle**: sign-in screen, admin control-room overview, wedding detail
  (event metrics, delivery log, staff list), committee guest-operations workspace with
  refined RSVP badges and a polished family editor modal (`portal-*` classes in globals.css).
- **Seed reliability fix**: seed no longer `process.exit(0)`s before PGlite flushes —
  `closeDb()` added to `src/db/client.ts`; this was the cause of occasional e2e boots
  with missing tables.
- Validation: build ✅ e2e ✅ manual admin/committee/carousel checks ✅. E2E added an
  RSVP for The Khans, so dashboards show 8/12 responded. Nothing committed yet.
- **Next:** end-to-end animation revamp guide (anime.js v4 / GSAP / Motion research)
  lives at `docs/ANIMATION-REVAMP-GUIDE.pdf`.

## Earlier today (animation + accounts pass)

**Accounts (seeded, sign-in verified in browser):**

| Email | Role |
|---|---|
| `SEED_STAFF_EMAILS[0]` (default `admin@example.com`) | **admin** (verified: /admin loads) |
| `SEED_STAFF_EMAILS[2]` (default `committee@example.com`) | committee |
| `SEED_STAFF_EMAILS[1]` (default `couple@example.com`) | couple (verified: /couple + theme switch) |
| `SEED_STAFF_EMAILS[3]` (default `planner@example.com`) | committee |

Point `SEED_STAFF_EMAILS` at Gmail plus-aliases (`you+couple@`, `you+planner@`) and one
inbox receives every role's magic link, so a single account can demo all of them. The
seed now wipes the `users` table
outright (it's the only provisioning path), so changing the list no longer breaks reseeds.

**Scroll fix:** the old reveal used CSS `animation-timeline: view()`, which never fires
in Safari/Firefox and was broken in practice even in Chrome (sections sat at opacity 0).
Replaced with an IntersectionObserver system (`sections/ScrollFx.tsx`): `html.fx` arms the
hidden states pre-paint, the observer adds `.is-in` per element, and no-JS/reduced-motion
users always see content. Verified: 26/26 elements reveal on a real scroll.

**New animated components** (all token-driven — every theme gets them for free):
- Hero: letter-by-letter name reveal, foil-shimmer ampersand, falling marigold petals
  (SSR-stable, `prefers-reduced-motion` kills them), watermark ampersand parallax,
  live countdown (no CLS), animated scroll cue.
- Marquee band of event names under the hero (pauses on hover).
- Ornaments draw on (SVG `pathLength` stroke animation) — load-draw in hero, scroll-draw at dividers.
- Timeline row hairlines grow in from the left, staggered.
- Travel cards: "mounted invitation" treatment — double frame + bandhani dot field + hover lift.
- Gallery plates: matted frames with hover lift/tilt.
- RSVP band: gota-style scalloped top edge + foil RSVP kicker.

**Border cleanup:** section headers now use a tapered rule that fades out (can't double),
first timeline row drops its top rule (the header's rule serves), marquee owns its own
hairlines. Audited full-page at desktop + 390px: no doubled lines.

**Design research** (informed the above): editorial benchmark blissandbone.com; luxury
Indian invite designers Ravish Kapoor / Puneet Gupta (one hero ornament per composition,
restraint); Minted foil/deckle tier (foil gradient, layered mounting); 2025–26 trend
posts (WeddingSutra, Krafty Kaur). Unused ideas worth a future pass: Paperless-Post-style
envelope-open intro, wax-seal RSVP button, watercolour mask-bleed reveals for gulaab.

**Verified:** all three themes screenshotted desktop + 390px (no horizontal overflow,
no console errors), full auth loop for admin + couple, theme flip live from /couple,
19/19 unit tests, e2e pass, clean production build. Dev server left running on :3000;
DB freshly seeded (theme=ivory-editorial). NOT committed yet — say the word.

## Pending from Aadi (unchanged, for Task 16 deploy — commands in docs/DEMO-RUNBOOK.md)

1. Other founders' real emails, if/when they should replace the plus-aliases in `scripts/seed.ts`.
2. A Neon project's **pooled** `DATABASE_URL`.
3. A Gmail **app password** (for real invite/magic-link email).
4. `vercel login` on your machine, then set env + `vercel --prod`.

## Local conveniences
- RSVP links: `var/seed-urls.txt` (regenerated today — old links are dead; e2e also rotates them)
- Magic links / invite mails: `var/outbox/mail.jsonl`
- DB corruption fix: `npm run db:reset`
