# Wedding Platform MVP — Design Spec

**Date:** 2026-07-12
**Status:** Approved by Aadi (founders' first-customer pilot)
**Working name:** wedding-mvp (product naming = founders' decision, deferred)

## 1. Context & goals

First potential customer has a **November 2026 wedding**. Two deadlines:

1. **Demo in 10 days (by ~2026-07-22):** polished, deployed demo on fake data —
   all four role views working, real invite emails sent to the founders' inboxes,
   **3 switchable themes**. Purpose: close the customer.
2. **Production by ~October 2026:** real guest list, real emails at scale
   (domain + Resend), content editing, hardening.

Business context: this is the "website + invites + RSVP" wedge of the wedding
one-stop-shop idea (see startup-hq). The guest/family data model must
future-proof the later singles/dating feature and family-side graph without
building any of it now.

Constraints: ₹0/month infrastructure (free tiers only), part-time team,
stack the team already knows how to deploy (Vercel).

## 2. Stack (Approach A — approved)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) | One codebase for all views + API; team knows the Vercel pipeline |
| Hosting | Vercel free tier | Known deploy path, preview URLs for demos |
| DB | Neon Postgres free tier | Serverless, survives to production scale |
| ORM | Drizzle | Typed schema, cheap migrations |
| Staff auth | Auth.js (NextAuth v5), email magic-link | Passwordless, role-based, CSRF + httpOnly cookies built in |
| Guest auth | Per-family tokenized magic links (no accounts) | Guests will not create passwords; see §6 |
| Email | Nodemailer + Gmail app-password SMTP (demo) → Resend + own domain (production) | Same code path, swap transport via env |
| Email templates | React Email | Themed HTML invites that match the site |
| Styling | Tailwind CSS v4 + CSS-variable theme tokens | 3 themes as token sets, instant switching |
| Validation | Zod on every mutation | Never trust the client |

Decision deferred: buy product domain (~₹700–1000/yr) before production sends.
Rejected: Supabase (new platform under a 10-day clock, fiddly 4-role RLS);
static site + Google Forms (demos as a homepage, not a product).

## 3. Surfaces (routes)

| Route | Audience | Access | Contents |
|---|---|---|---|
| `/w/[slug]` | Public / guests | Public | Themed wedding site: hero + couple story, event timeline (haldi → mehendi → sangeet → pheras → reception) each with datetime, venue, address, map link, dress code; travel & stay; gallery (seeded photos for demo); RSVP call-to-action |
| `/rsvp/[token]` | Invited family | Token in URL | Personalized: greets family by name, lists only the events that family is invited to, per-event headcount + attending/declined + optional note. Revisit = edit responses |
| `/couple` | Bride & groom | Auth.js, role `couple` | Live RSVP dashboard: per-event counts, response rate, non-responders list, **theme switcher**, read-only guest list. (Content editing = production phase) |
| `/committee` | Planner / trusted relatives | Auth.js, role `committee` | Guest-list operations: add/edit families and members, assign side (bride/groom/both) + relation, map families → events, send/resend invite emails, per-event headcount totals for caterers. No couple settings |
| `/admin` | Us (founders) | Auth.js, role `admin` | Create/manage weddings, email log, open any wedding's views for support and demos |

Role hierarchy for reads: admin ⊃ committee ⊃ couple dashboards. Mutations are
checked per-role server-side on every request (middleware gates the route
group; each server action re-verifies role + wedding ownership).

## 4. Data model (Postgres via Drizzle)

- **weddings** — id, slug, couple names, theme (`raj-mahal | gulaab-rococo | ivory-editorial`), wedding date, hero copy fields, created_at
- **events** — id, wedding_id FK, name, starts_at, venue name, address, map_url, dress_code, sort_order
- **families** — id, wedding_id FK, family name, side (`bride | groom | both`), relation (free text, e.g. "Mama's family"), email, invite_token_hash (SHA-256), token_expires_at, created_at
- **guests** — id, family_id FK, full name, age_group (`adult | child`). Individual members under a family: future-proofs singles opt-in + family-side graph
- **event_invites** — event_id + family_id (composite PK): which family is invited to which event
- **rsvps** — id, event_id FK, family_id FK, status (`attending | declined`), headcount, note, responded_at; unique (event_id, family_id)
- **users** — id, email, name, role (`admin | couple | committee`), wedding_id FK nullable (null for admin = all weddings)
- **email_log** — id, family_id FK, type (`invite | reminder | resend`), sent_at, transport status

Integrity rules: an RSVP may only exist where an event_invite exists;
headcount ≥ 1 when attending; headcount ≤ family member count + 2 (buffer for
"+ driver/nanny" reality, server-enforced).

## 5. Email → RSVP flow

1. Committee (or admin) clicks **Send invites** for selected families.
2. Server generates a 32-byte random token per family, stores **only the
   SHA-256 hash** + expiry (wedding date + 7 days), builds a themed React
   Email invite containing `https://<host>/rsvp/<token>`, sends via the
   transport in env (`SMTP_*` for Gmail now, Resend key later). Send result
   → email_log.
3. Guest clicks → `/rsvp/[token]`: hash the token, look up family, render
   their events, accept per-event responses. No login, no password.
4. RSVP writes are immediately visible to couple/committee/admin dashboards
   (server-rendered reads; no realtime infra needed for MVP).
5. **Resend** regenerates the token and invalidates the old one.
   **Remind** re-uses the live token, targets non-responders only.

Failure handling: SMTP failures recorded in email_log with status, surfaced
in committee view as "failed — retry"; invalid/expired token page shows a
warm apology + "ask the family to resend your link" (committee resends).
Self-service "request a fresh link" (emails the address on file, never
revealed in the UI) = production scope.

## 6. Auth & safety model

**Guests — tokenized magic links, no accounts.**
- 32-byte cryptographically random token; DB stores only the SHA-256 hash, so
  a DB leak exposes nothing usable.
- Scope: one family. Expiry: wedding + 7 days. Revocable (resend regenerates).
- RSVP endpoints rate-limited (per-IP and per-token).
- Accepted trade-off: the link is shareable within a household by design
  (uncle forwards it to the family WhatsApp group — that is a feature). Blast
  radius of a leaked link = one family's headcount, nothing more.

**Staff (couple / committee / admin) — Auth.js v5, email magic-link sign-in.**
- Passwordless: nothing to phish, store, or leak.
- Sessions in httpOnly secure cookies; CSRF protection from Auth.js.
- Sign-in allowed only for emails pre-provisioned in `users` (no self-signup).
- Role + wedding-ownership re-checked server-side on every mutation; UI
  hiding is never the enforcement layer.
- All inputs validated with Zod at the server boundary.

## 7. Theming

A theme = one token set + swappable ornament components. Tokens are CSS
variables set via `data-theme` on the root: palette, font pairing
(`next/font`), motif/ornament SVGs, border and divider treatments. Sections
are theme-agnostic in structure; heroes and dividers accept per-theme
ornament components.

| Theme | Palette | Type | Motifs | Vibe |
|---|---|---|---|---|
| **Raj Mahal** | deep maroon, gold, indigo | Cormorant Garamond + Inter | Mughal jaali arch frames | Royal heritage (2026 trend: deep royal Indian colors — rani pink, indigo, turmeric) |
| **Gulaab Rococo** | blush, rani pink, lavender | Fraunces + Inter | watercolour florals, scalloped ornamental frames | Romantic, lavish (Rococo searches +1000%, soft pink +473% on Pinterest) |
| **Ivory Editorial** | ivory, charcoal, single marigold accent | display serif + Inter, oversized headings | whitespace, hairline rules | Modern minimal, "not too much" |

Dropped for demo: Haldi Pop (vibrant festive) — overlaps Raj Mahal; the three
kept form a max-contrast triangle (royal / romantic / minimal). Candidate for
a production 4th theme.

Implementation uses the frontend-design skill; the bar is "customer gasps,"
not "AI template."

## 8. Demo scope vs production scope

**Demo (10 days):**
- Seeded fake wedding "Ananya weds Arjun": 5 events, ~12 families, ~35 guests
  across both sides, partial RSVPs pre-seeded so dashboards look alive.
- All four views functional; real emails to the four founders' inboxes via
  Gmail SMTP; theme switching live from the couple view; deployed on Vercel.

**Production (by October), explicitly deferred now:**
- Couple self-serve content editing; CSV guest-list import; reminder
  scheduling; photo hosting (Drive-wrapper first); product domain + Resend +
  SPF/DKIM; per-guest RSVP granularity if a customer demands it; second
  wedding tenancy polish; singles feature (separate spec when its time comes).

## 9. Testing

- Unit: token generate/hash/verify/expiry, RSVP validation rules
  (invite-scoping, headcount bounds), role checks on server actions.
- E2E (Playwright, one happy path): admin seeds → committee sends invite →
  capture invite URL (test transport writes to file/maildev, no real SMTP in
  tests) → guest RSVPs for 2 of 3 events → couple dashboard shows updated
  counts.
- Email rendering: React Email snapshot per theme.

## 10. Risks

- **Gmail SMTP deliverability** — fine for 4 founder inboxes; must move to
  domain + Resend before any real guest sends. Tracked as a production gate.
- **10-day clock vs 3 themes** — themes are the differentiator, so structure
  ships first on Ivory Editorial (cheapest), then Raj Mahal, then Gulaab
  Rococo; a 2-theme demo is the fallback, never a broken 3-theme one.
- **DPDP/privacy** — guest names + emails are personal data even in demo;
  fake data for demo sidesteps it; production needs a privacy note on the
  RSVP page (one paragraph, not a legal project).
