# How wedding-mvp works — the plain-language guide

**Who this is for:** you, the person who has to demo this, sell it, and answer "so how does it
actually work?" without having written it. No coding background assumed. If a word looks
technical, it is explained the first time it appears and again in the glossary at the end.

**What the product is, in one line:** each couple gets a beautiful wedding website, every
invited family gets a personal RSVP link by email, and the couple, their planner, and we (the
founders) each get a dashboard that shows who is coming.

---

## 1. The three parts every web app has

Think of a restaurant.

| Restaurant | Web app | In this project |
|---|---|---|
| **The dining room** — what customers see and touch | **Frontend** — the pages in the browser: text, buttons, colours, animations | The wedding site, the RSVP page, the dashboards |
| **The kitchen** — where the work happens, customers never enter | **Backend** — code that runs on a server (a computer in a data centre), checks who you are, decides what you may do, reads and writes data | Sign-in checks, "is this RSVP link valid?", sending emails, saving answers |
| **The store room** — where everything is kept | **Database** — a structured store of records that survives restarts | The list of weddings, events, families, guests, RSVPs, staff logins |

A waiter carries orders from the dining room to the kitchen and plates back. On the web that
waiter is **HTTP**: the browser sends a request ("show me `/rsvp/abc123`"), the server sends
back a response (the page).

**Frontend vs backend is about *where the code runs*, not what it looks like.** Frontend code
runs on the guest's phone. Backend code runs on our server. Anything secret (email
passwords, database access, "is this person allowed?") must live in the backend, because
anything sent to a phone can be read by whoever holds the phone.

### Where this project blurs the line, on purpose

Most older stacks build the frontend and backend as two separate programs that talk over an
"API" (a menu of URLs the frontend can call). This project uses **Next.js**, which lets one
codebase do both. A page file can say "run this part on the server, send the finished HTML to
the browser". So when you open the committee dashboard, the server fetches the guest list
from the database, builds the table, and ships the finished table to your browser. The
browser never receives anything it shouldn't.

The trade-off is that the folders don't neatly split into `frontend/` and `backend/`. The
rule of thumb for reading the code: a file that starts with `"use client"` runs in the
browser; a file that starts with `"use server"` runs only on the server; anything else in
`src/app/` is a server-rendered page unless told otherwise. `docs/FRAMEWORK.md` goes deep on
why this stack was chosen over the classic split.

---

## 2. The cast: who uses it and what they see

| Person | How they get in | What they see | URL |
|---|---|---|---|
| **Guest** (an invited family) | Clicks the link in their invite email. No account, no password. | Their family's RSVP page: only the events *they* are invited to, one answer per event | `/rsvp/<secret-token>` |
| **Anyone** | Opens the public link | The couple's themed wedding site | `/w/ananya-weds-arjun` |
| **Couple** | Email magic link | RSVP numbers, who hasn't replied, theme switcher for their site | `/couple` |
| **Committee** (planner, an uncle, whoever runs the list) | Email magic link | Add and edit families, send invites and reminders, per-event headcounts, **import a spreadsheet** | `/committee` |
| **Admin** (us) | Email magic link | Every wedding, its staff, the email delivery log, the outbox viewer | `/admin` |

"Magic link" means: you type your email, we send you a one-time sign-in link, you click it,
you're in. There are no passwords anywhere in the product. Only email addresses we have
already put in the staff table can sign in; a stranger typing their email gets a polite
"if that address is on the team, a link is on its way" and nothing else.

---

## 3. A guest's journey, step by step

This is the flow to narrate in a demo. Every step names which part (frontend, backend,
database, email) is doing the work.

1. **Committee clicks "Send invites"** on `/committee` (frontend button).
2. **Backend** generates a long random secret for that family, called a *token*. It stores
   only a scrambled fingerprint of it (a *hash*) in the **database**, never the token itself.
   So even if someone stole the database, they could not build a working link.
3. **Backend** renders the invite email in the couple's theme colours and hands it to the
   **mail transport**. Locally that transport writes the mail into a file
   (`var/outbox/mail.jsonl`); in production it sends through Gmail.
4. **Guest** opens the email on their phone and taps the button. The link contains the token.
5. **Backend** scrambles the token it received, looks up the fingerprint in the database,
   finds the family, checks the link hasn't expired (a week after the wedding), and builds
   their personal page: "Dear Mehta Family", plus only their events.
6. **Guest** picks attending or declined per event, a headcount, an optional note, and
   submits. **Backend** validates it (invited to this event? headcount within the family
   size plus two?) and writes the RSVP into the **database**. Resubmitting later edits the
   same answer instead of creating a second one.
7. **Couple** reloads `/couple`. The **backend** counts the RSVPs fresh from the database and
   the numbers move. No refresh trickery, no real-time plumbing: every dashboard load is a
   fresh count.

Things worth knowing when someone asks:

- **"What if the guest forwards the link?"** Then the whole household can answer from it.
  That is a feature. The worst case of a leaked link is one family's headcount.
- **"What if they lose the link?"** Committee clicks "Resend link". That mints a new token
  and the old one stops working.
- **"Reminders"** go only to families who haven't answered every event they were invited to.

---

## 4. What lives in the database

Six tables matter. Think of each as a spreadsheet tab with fixed columns.

| Table | One row is… | Key columns |
|---|---|---|
| `weddings` | one couple's wedding | names, date, theme, the site's slug (`ananya-weds-arjun`), story text |
| `events` | one function of that wedding | name (Haldi, Sangeet, Pheras…), when, venue, address, dress code |
| `families` | one household that gets **one** invite email | family name, side (bride / groom / both), relation, email, token fingerprint, expiry |
| `guests` | one person inside a family | full name, adult or child |
| `event_invites` | "this family is invited to this event" | family + event |
| `rsvps` | one family's answer for one event | attending or declined, headcount, note, when |

Plus `users` (staff logins and their role), `email_log` (every send, success or failure), and
three tables the sign-in library needs for sessions.

Why families and not individuals? Because Indian invites go to households, one email per
household is realistic, and the committee thinks in "the Mehtas, 4 people, Sangeet and
Reception". Individual guests are still recorded so a future per-person feature is possible.

---

## 5. Folder map, in plain English

```
src/
  app/                    ← every URL in the product is a folder here
    w/[slug]/             ← the public wedding site  (/w/ananya-weds-arjun)
    rsvp/[token]/         ← the guest RSVP page      (/rsvp/…)
    couple/               ← couple dashboard
    committee/            ← committee dashboard
      import/             ← the spreadsheet / direct-entry intake portal
    admin/                ← admin overview, per-wedding detail, mailroom
    signin/               ← magic-link sign-in
  db/                     ← the database's blueprint (schema.ts) and the connection switch
  lib/                    ← the backend logic: rsvp rules, invites, tokens, mail, roles
    import/               ← spreadsheet reading, column matching, AI helper, row building
  themes/                 ← the six looks: colours, fonts, ornaments
  emails/                 ← the invite email template
drizzle/                  ← database change scripts ("migrations"), applied in order
scripts/seed.ts           ← fills a fresh database with the two demo weddings
tests/                    ← automated checks (unit = small pieces, e2e = a real browser)
docs/                     ← this file, the demo runbook, the stack rationale
var/                      ← local-only scratch: the embedded database, the mail outbox
```

Square brackets in a folder name (`[slug]`, `[token]`) mean "this part of the URL is a
variable". `/w/ananya-weds-arjun` and `/w/gaurav-weds-karishma` are the same page fed
different data.

---

## 6. Getting it running on your laptop

Nothing needs the internet after the first install. There is no database server to install:
locally the app uses **PGlite**, a Postgres database that runs inside the app and stores its
files in `var/pglite/`.

**Once, on a new machine**

```bash
# 1. Node.js 20 or newer must be installed (node -v to check)
cd ~/projects/wedding-mvp
npm install                     # downloads the libraries listed in package.json
cp .env.example .env            # your private settings file (never committed)
```

Open `.env` and set `AUTH_SECRET` to any long random string. This command prints one:

```bash
openssl rand -base64 33
```

Leave `DATABASE_URL` empty (that means "use the embedded database") and `EMAIL_MODE=file`
(that means "write emails to a file instead of sending them").

**Every time you want to work on it**

```bash
npm run seed      # wipes and refills the local database with the two demo weddings
npm run dev       # starts the app at http://localhost:3000
```

The seed prints every family's RSVP link and also saves them to `var/seed-urls.txt`.

**Signing in locally.** Because emails are written to a file, "sending" a magic link means
a new line appears in `var/outbox/mail.jsonl`. Easiest path: go to `/signin`, type
`admin@example.com` (the default seeded admin), then open `/admin/mailroom` in the same
browser — it lists every outbox mail with a clickable sign-in link. Default local logins:

| Role | Email |
|---|---|
| admin | `admin@example.com` |
| couple | `couple@example.com` |
| committee | `committee@example.com` and `planner@example.com` |

**One rule that bites:** the embedded database allows **one program at a time**. Stop
`npm run dev` (Ctrl-C) before running `npm run seed`, `npm run db:reset`, or `npm run e2e`.
If the database ever behaves strangely, `npm run db:reset` deletes it and reseeds.

**Checking your work**

| Command | What it proves |
|---|---|
| `npm test` | the small automated checks pass (tokens, RSVP rules, roles, imports…) |
| `npm run e2e` | a real headless browser can go from invite to RSVP to dashboard |
| `npm run build` | the app compiles for production without errors |

---

## 7. Putting it on the internet

Production swaps the two local stand-ins for real services, both on free tiers:

| Local | Production | Set by |
|---|---|---|
| Embedded PGlite database | **Neon** hosted Postgres | `DATABASE_URL` |
| Emails written to a file | **Gmail** SMTP with an app password | `EMAIL_MODE=smtp`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` |
| `http://localhost:3000` | `https://<your-app>.vercel.app` | `APP_URL` |

The app is hosted on **Vercel**: you run `vercel --prod` and it builds and publishes.
`docs/DEMO-RUNBOOK.md` has the exact commands in order, the ten-minute demo script, and the
offline fallback plan. The three things only you can supply are a Neon connection string, a
Gmail app password, and `vercel login` on your machine.

---

## 8. Getting guest data in: the intake portal

Couples arrive with a guest list in Excel or Google Sheets, and every list is shaped
differently. The intake portal at `/committee/import` handles that without asking anyone to
reformat their spreadsheet.

**Two ways in, the committee picks:**

- **Upload a spreadsheet** (`.xlsx`, `.xls`, or `.csv`). The backend reads it, works out
  which row is the header, and profiles every column (what's in it, how full it is, sample
  values). Then it proposes how the columns map onto our fields: family name, guest names,
  side, relation, email, adult/child, headcount, and which events each family is invited to.
  If an AI key is configured, an AI model does the matching and explains what it noticed;
  without one, a built-in matcher works from column names and cell values. Either way the
  proposal is shown for you to correct, and the portal **asks** the questions the sheet
  can't answer: is each row a household or a single person, how should people be grouped
  into households, which events should everyone be invited to if the sheet doesn't say,
  what to do with rows that have no email.
- **Type it in.** The same review grid, starting empty. Add a row per household, or use the
  single-family editor on `/committee` for one at a time.

Both paths end at the same **review grid**: every household on one editable line, with a
flag on anything that needs a human (no email, unknown side, duplicate of a family already
in the system). Fix inline, then "Import N households" writes them into the database with
exactly the same validation as the hand-typed form. Nothing touches the database until that
final click, so you can abandon an upload at any step.

**AI setting.** Three optional lines in `.env` switch the AI matcher on:

```
AI_API_KEY=...                                  # any OpenAI-compatible provider key
AI_BASE_URL=https://api.groq.com/openai/v1      # default: Groq (free tier)
AI_MODEL=openai/gpt-oss-120b                    # default
```

Only column names and a handful of sample cells are sent to the model, never the full
sheet. Leave `AI_API_KEY` empty and the portal still works, just with the name-based matcher.

---

## 9. When something breaks

| Symptom | Likely cause | Fix |
|---|---|---|
| "relation … does not exist" or a blank dashboard | database not seeded, or seed ran while the dev server was up | stop the server, `npm run db:reset`, start again |
| Sign-in link never "arrives" locally | it did — it's in the outbox file, not your inbox | open `/admin/mailroom` or `var/outbox/mail.jsonl` |
| An RSVP link says invalid | links rotate on every send and reseed | use the newest one from the outbox or `var/seed-urls.txt` |
| Invite send shows "failed" | Gmail app password wrong, or `EMAIL_MODE=smtp` locally without credentials | check `.env`; locally keep `EMAIL_MODE=file` |
| `npm run dev` says port 3000 in use | an old server is still running | find and stop it, or it will tell you the next free port |
| Import says "AI unavailable" | no `AI_API_KEY`, or the provider is down | the name-based matcher already ran; correct the mapping by hand |

---

## 10. Glossary

- **Frontend** — code that runs in the visitor's browser; everything they see and click.
- **Backend** — code that runs on our server; checks, rules, database access, email.
- **Database** — the permanent store of records. Here: Postgres.
- **Postgres** — a widely used open-source database. **PGlite** is a version of it that runs
  inside the app for local work. **Neon** hosts it in the cloud.
- **Schema** — the blueprint of the database: which tables exist and what columns they have.
  `src/db/schema.ts` is ours. A **migration** is a script that changes the schema safely.
- **Drizzle** — the library that lets our code talk to the database in TypeScript instead of
  raw SQL.
- **Next.js** — the framework that turns folders in `src/app/` into web pages and lets the
  same project run server code and browser code.
- **React** — the library Next.js uses to build pages out of reusable pieces ("components").
- **Server action** — a backend function a button can call directly; the file starts with
  `"use server"`. All our saving and sending goes through these.
- **Token** — a long random secret in a URL that stands in for a login. **Hash** — a
  one-way scramble of it; we store the hash, not the token.
- **Magic link** — a one-time sign-in URL sent by email instead of a password.
- **Session** — the browser cookie that remembers a signed-in staff member.
- **Role** — admin, couple, or committee; decides which pages and actions are allowed.
  Checked on the server on every request, never trusted from the browser.
- **SMTP** — the protocol for sending email. Gmail's SMTP is used for the pilot.
- **Environment variables / `.env`** — private settings that differ per machine (keys,
  URLs). Never committed to git.
- **Seed** — a script that fills an empty database with demo data.
- **Unit test / e2e test** — small automated checks of one piece / a full browser run.
- **Vercel** — the hosting service that builds and publishes the app.
- **Slug** — the readable part of a URL, like `ananya-weds-arjun`.
