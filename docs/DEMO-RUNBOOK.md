# Demo Runbook — Ananya weds Arjun

Ten minutes, seven beats. Rehearse once the night before.

## Pre-demo setup (do once, ~30 min)

### 1. Swap staff emails
In `scripts/seed.ts`, replace the four `STAFF_EMAILS` entries with the founders'
real addresses (Aadi = admin, one couple, two committee). Magic-link sign-in
only works for provisioned addresses.

### 2. Neon (free tier)
1. console.neon.tech → new project → copy the **pooled** connection string.
2. ```bash
   DATABASE_URL='<pooled-url>' npx drizzle-kit migrate
   DATABASE_URL='<pooled-url>' APP_URL='https://<prod-url>' EMAIL_MODE=file npx tsx scripts/seed.ts | tee seed-urls-prod.txt
   ```
3. Keep `seed-urls-prod.txt` — those are the live RSVP links for the demo. Do
   NOT commit it.

### 3. Vercel
```bash
vercel link
vercel env add DATABASE_URL      # pooled Neon URL
vercel env add AUTH_SECRET       # openssl rand -base64 33  (fresh, not the local one)
vercel env add APP_URL           # https://<prod-url>
vercel env add EMAIL_MODE        # smtp
vercel env add SMTP_USER         # the gmail address
vercel env add SMTP_PASS         # app password from myaccount.google.com/apppasswords
vercel env add EMAIL_FROM        # "Ananya & Arjun <that-gmail@gmail.com>"
vercel --prod
```

### 4. Production smoke (15 min, from a phone + laptop)
1. Sign in at `/signin` with the admin email → real magic link lands in Gmail.
2. `/committee` → edit two families → set their emails to founder addresses →
   select them → **Send invites** → check the Gmail inboxes.
3. Tap the RSVP link on a phone → answer → watch `/couple` numbers move.
4. Switch all three themes from `/couple` and reload `/w/ananya-weds-arjun`.

## The demo script (in order)

1. **The site.** Open `/w/ananya-weds-arjun` on **raj-mahal**. Scroll slowly —
   hero, story, the five celebrations, gallery. Let it breathe.
2. **The invite.** "This is what your guests get." Show the real invite email
   in Gmail — same palette as the site.
3. **The RSVP.** Tap the email's button on a phone. "Dear Mehta Family" — no
   app, no password, answer in 30 seconds.
4. **The couple view.** `/couple` on the laptop, already signed in. Submit the
   phone RSVP mid-sentence — the number ticks up on reload.
5. **The moment.** Theme switcher: click **Gulaab Rococo**, open the site tab,
   reload. One click, whole new wedding. Pause here.
6. **The committee view.** "Your planner or your chachu manages everything
   here — you never touch a spreadsheet." Show add-family, send/remind.
7. **Pricing conversation.**

## Sign-ins

| Role | Email | Where |
|---|---|---|
| Admin | (Aadi's real email after swap) | `/admin` |
| Couple | (founder #2) | `/couple` |
| Committee | (founders #3, #4) | `/committee` |

## Fallback plan (if Gmail or Vercel misbehaves on the day)

Run it all locally — nothing needs the internet:

```bash
npm run db:reset          # wipes + reseeds local PGlite, prints RSVP URLs
npm run dev               # EMAIL_MODE=file → mails land in var/outbox/mail.jsonl
```

Magic links and invite mails are read out of `var/outbox/mail.jsonl`
(`signInUrl` / `rsvpUrl` fields). Same demo, mails shown from the outbox file
instead of Gmail — narrate it as "the mail transport is swappable."

## Sharp edges (local dev)

- **PGlite is single-process.** Never run `npm run seed` (or any script that
  touches the DB) while `npm run dev` is up — stop the server first. If the DB
  ever gets corrupted: `npm run db:reset`.
- E2E (`npm run e2e`) manages its own server and wipes the local DB — don't
  run it while a dev server is up.
- `npm run build` uses an in-memory DB and never touches `var/pglite`.
