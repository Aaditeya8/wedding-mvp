# wedding-mvp

A multi-tenant Indian wedding platform: a themed public wedding site per couple, a
token-link RSVP flow for guests, and three staff dashboards (couple, committee, admin)
behind passwordless sign-in.

Built as a first-customer pilot — small enough for one developer to run end to end,
real enough to put in front of a paying couple.

## What it does

- **Public wedding site** — `/w/[slug]`. Hero, story, event timeline, travel & stay,
  gallery, RSVP call-to-action. Six switchable themes, server-rendered, with per-wedding
  Open Graph metadata so a link shared on WhatsApp unfurls properly.
- **Guest RSVP** — `/rsvp/[token]`. No account, no password. One emailed link per family,
  per-event attendance and headcount, editable on revisit. Tokens are stored as SHA-256
  hashes and expire a week after the wedding.
- **Committee dashboard** — `/committee`. Add and edit families and their guests, send
  invites, resend, chase non-responders, per-event totals.
- **Couple dashboard** — `/couple`. RSVP stats, who hasn't replied, and a live theme
  switcher for their own site.
- **Admin** — `/admin`. All weddings, staff, delivery log, plus `/admin/mailroom`, an
  outbox viewer for magic links and invite mail.
- **Invite email** — themed to match the couple's site, rendered with React Email,
  delivered over SMTP or written to a local outbox file.

## Stack

Next.js 16 (App Router, React Server Components, Server Actions) · React 19 · TypeScript ·
Tailwind CSS v4 · Drizzle ORM · Postgres (PGlite locally, Neon in production) · Auth.js v5
magic links · Zod · React Email + Nodemailer · Vitest + Playwright.

**Why this stack, and how it compares to MERN:** [`docs/FRAMEWORK.md`](docs/FRAMEWORK.md) —
also as a formatted document, [`docs/FRAMEWORK.pdf`](docs/FRAMEWORK.pdf) (7 pages, rendered
from [`docs/framework.html`](docs/framework.html)).

## Running it locally

Requires Node 20+. No Docker, no database server, no cloud account — local dev runs on
[PGlite](https://pglite.dev), an embedded WASM Postgres that lives in `var/pglite`.

```bash
npm install
cp .env.example .env          # generate AUTH_SECRET: openssl rand -base64 33
npm run seed                  # migrates + seeds two demo weddings, prints RSVP links
npm run dev                   # http://localhost:3000
```

The seed prints guest RSVP URLs to stdout and `var/seed-urls.txt`. With the default
`EMAIL_MODE=file`, every outgoing mail — sign-in magic links included — is appended to
`var/outbox/mail.jsonl` instead of being sent, and is readable in the UI at
`/admin/mailroom`. That means the whole product, sign-in included, demos offline.

Staff logins default to `@example.com` placeholders. To receive real magic links, point
`SEED_STAFF_EMAILS` at five comma-separated addresses in role order — admin, couple,
committee, committee, and the second wedding's couple — then re-seed:

```bash
SEED_STAFF_EMAILS='you@gmail.com,you+couple@gmail.com,you+chachu@gmail.com,you+planner@gmail.com,you+karishma@gmail.com' npm run seed
```

There is no self-signup by design: `signIn` rejects any address that isn't already a
provisioned user row, so the seed is the only provisioning path.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (uses a throwaway in-memory DB) |
| `npm run seed` | Migrate + reseed both demo weddings, print RSVP links |
| `npm run db:reset` | Delete `var/pglite` and reseed from scratch |
| `npm test` | Vitest unit suite (19 tests) |
| `npm run e2e` | Playwright end-to-end guest RSVP flow |

### Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string. **Leave unset** locally to use embedded PGlite. |
| `AUTH_SECRET` | Auth.js signing secret — `openssl rand -base64 33` |
| `APP_URL` | Base URL used to build RSVP links |
| `EMAIL_MODE` | `file` (outbox) or `smtp` (real delivery) |
| `SMTP_USER` / `SMTP_PASS` | Gmail address + app password, when `EMAIL_MODE=smtp` |
| `EMAIL_FROM` | Display sender, e.g. `"Ananya & Arjun <you@gmail.com>"` |
| `SEED_STAFF_EMAILS` | Optional. Five comma-separated staff logins for the seed. |

## Layout

```
src/
  app/
    w/[slug]/        public wedding site + its sections
    rsvp/[token]/    guest RSVP page and server action
    couple/          couple dashboard
    committee/       guest operations
    admin/           overview, per-wedding detail, mailroom
    signin/          magic-link sign-in
  db/                Drizzle schema + the PGlite/Neon client switch
  lib/               rsvp, invites, tokens, mailer, authz, ratelimit
  themes/            theme catalog, CSS custom-property tokens, SVG ornaments
  emails/            React Email invite template
  auth.ts            Auth.js config (Drizzle adapter, Nodemailer provider)
  proxy.ts           coarse "has a session cookie?" gate
drizzle/             SQL migrations
tests/unit           Vitest
tests/e2e            Playwright
scripts/             seed, set-theme
```

Authorization is deliberately **not** in `proxy.ts`. That file only bounces
cookie-less visitors to `/signin`; real role and wedding-ownership checks run in
`requireRole()` inside every page and server action, where the database session can
actually be read.

## Sharp edges

- **PGlite allows one process at a time.** Don't run `npm run seed` while `npm run dev`
  is up — stop the server first. `npm run db:reset` fixes a corrupted local DB.
- `npm run e2e` manages its own server and wipes the local database.
- Reminders mint a fresh invite token, which invalidates the family's previous link.
  Tokens are stored hash-only, so the original can't be recovered — each mail carries a
  working link, and only the newest one works.

## Status

Feature-complete for the pilot demo and verified in a browser: 19 unit tests, a Playwright
RSVP happy path, and a clean production build. Not yet deployed. `docs/DEMO-RUNBOOK.md`
covers the Neon + Vercel + Gmail setup and the demo script; `STATUS.md` is the running
build log.
