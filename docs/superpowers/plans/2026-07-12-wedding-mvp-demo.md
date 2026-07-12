# Wedding MVP Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed demo wedding platform — themed public wedding site, email → tokenized RSVP flow, and couple/committee/admin dashboards — on fake data, in 10 days.

**Architecture:** Single Next.js App Router app on Vercel. Postgres (Neon in prod, PGlite in-process for dev/tests — zero local setup) via Drizzle. Guests authenticate by per-family magic-link tokens (SHA-256 hash at rest); staff authenticate via Auth.js v5 email magic-links with role checks server-side. Email goes through one transport factory: `file` mode (writes JSON to `var/outbox/`) for dev/tests, `smtp` (Gmail app password) for the demo, Resend later — same calling code.

**Tech Stack:** Next.js 15+ (App Router), TypeScript, Tailwind CSS v4, Drizzle ORM, @electric-sql/pglite, @neondatabase/serverless, Auth.js (next-auth@5), nodemailer, @react-email/components, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-12-wedding-mvp-design.md` — read it first; it is the contract.

## Global Constraints

- ₹0/month: Vercel free tier, Neon free tier, Gmail SMTP. No paid services.
- Theme names exactly: `ivory-editorial`, `raj-mahal`, `gulaab-rococo` (DB enum + `data-theme` values).
- Roles exactly: `admin`, `couple`, `committee`. Family sides exactly: `bride`, `groom`, `both`. RSVP status exactly: `attending`, `declined`.
- Every mutation: Zod-validate input, re-check role + wedding ownership server-side. UI hiding is never the enforcement layer.
- Guest token: 32 random bytes, only SHA-256 hash stored, expiry = wedding date + 7 days.
- Demo wedding slug: `ananya-weds-arjun`.
- Env vars (`.env.example` is canonical): `DATABASE_URL` (unset locally → PGlite at `var/pglite`), `AUTH_SECRET`, `APP_URL`, `EMAIL_MODE` (`file`|`smtp`), `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.
- Visual work (Tasks 9–11, 14) MUST be done with the frontend-design skill. Bar: "customer gasps", not "AI template".
- Commit after every green test cycle. No Claude attribution in commits.

---

### Task 1: Scaffold

**Files:**
- Create: entire app via `create-next-app`, then `vitest.config.ts`, `.env.example`, `src/lib/`, `src/db/`, `var/` (gitignored)

**Interfaces:**
- Produces: repo layout every later task assumes: `src/app/`, `src/db/`, `src/lib/`, `src/emails/`, `src/themes/`, `scripts/`, `tests/unit/`, `tests/e2e/`.

- [ ] **Step 1: Scaffold app**

```bash
cd ~/projects/wedding-mvp
npx create-next-app@latest . --ts --tailwind --app --src-dir --no-eslint --import-alias "@/*" --use-npm --yes
npm i drizzle-orm @electric-sql/pglite @neondatabase/serverless zod nodemailer next-auth@beta @auth/drizzle-adapter @react-email/components
npm i -D drizzle-kit vitest @types/nodemailer tsx @playwright/test
mkdir -p src/db src/lib src/emails src/themes scripts tests/unit tests/e2e var
echo "var/" >> .gitignore
```

- [ ] **Step 2: Add `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 3: Add `.env.example`**

```bash
# Leave DATABASE_URL unset locally to use embedded PGlite at var/pglite
DATABASE_URL=
AUTH_SECRET=generate-with-openssl-rand-base64-33
APP_URL=http://localhost:3000
EMAIL_MODE=file            # file | smtp
SMTP_USER=you@gmail.com
SMTP_PASS=gmail-app-password
EMAIL_FROM="Ananya & Arjun <you@gmail.com>"
```

- [ ] **Step 4: Verify build + test runner**

Run: `npm run build && npx vitest run`
Expected: build succeeds; vitest reports "no test files found" exit 0 (add `--passWithNoTests` to the npm script: `"test": "vitest run --passWithNoTests"`).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with drizzle/auth/email deps"
```

---

### Task 2: Database schema + client

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`
- Test: `tests/unit/schema.test.ts`

**Interfaces:**
- Produces: `db` (Drizzle instance) from `@/db/client`; tables `weddings, events, families, guests, eventInvites, rsvps, users, emailLog` from `@/db/schema`; `migrateDb()` from `@/db/client` (runs SQL migrations, used by tests/seed).

- [ ] **Step 1: Write failing test `tests/unit/schema.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { db, migrateDb } from "@/db/client";
import { weddings, families, guests } from "@/db/schema";

describe("schema", () => {
  beforeAll(async () => { await migrateDb(); });

  it("inserts a wedding with a family and guests", async () => {
    const [w] = await db.insert(weddings).values({
      slug: "test-wed", brideName: "A", groomName: "B",
      theme: "ivory-editorial", weddingDate: new Date("2026-11-20"),
    }).returning();
    const [f] = await db.insert(families).values({
      weddingId: w.id, name: "Sharma Family", side: "bride",
      relation: "Mama's family", email: "sharma@example.com",
    }).returning();
    await db.insert(guests).values([
      { familyId: f.id, fullName: "Rakesh Sharma", ageGroup: "adult" },
      { familyId: f.id, fullName: "Pinky Sharma", ageGroup: "child" },
    ]);
    expect(w.theme).toBe("ivory-editorial");
    expect(f.inviteTokenHash).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/schema.test.ts`
Expected: FAIL — cannot resolve `@/db/client`.

- [ ] **Step 3: Write `src/db/schema.ts`**

```ts
import { pgTable, pgEnum, text, integer, timestamp, uuid, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

export const themeEnum = pgEnum("theme", ["ivory-editorial", "raj-mahal", "gulaab-rococo"]);
export const sideEnum = pgEnum("side", ["bride", "groom", "both"]);
export const roleEnum = pgEnum("role", ["admin", "couple", "committee"]);
export const rsvpStatusEnum = pgEnum("rsvp_status", ["attending", "declined"]);
export const ageGroupEnum = pgEnum("age_group", ["adult", "child"]);
export const emailTypeEnum = pgEnum("email_type", ["invite", "reminder", "resend"]);

export const weddings = pgTable("weddings", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  brideName: text("bride_name").notNull(),
  groomName: text("groom_name").notNull(),
  theme: themeEnum("theme").notNull().default("ivory-editorial"),
  weddingDate: timestamp("wedding_date", { withTimezone: true }).notNull(),
  heroTagline: text("hero_tagline"),
  story: text("story"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  weddingId: uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  venueName: text("venue_name").notNull(),
  address: text("address").notNull(),
  mapUrl: text("map_url"),
  dressCode: text("dress_code"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const families = pgTable("families", {
  id: uuid("id").defaultRandom().primaryKey(),
  weddingId: uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  side: sideEnum("side").notNull(),
  relation: text("relation"),
  email: text("email").notNull(),
  inviteTokenHash: text("invite_token_hash"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const guests = pgTable("guests", {
  id: uuid("id").defaultRandom().primaryKey(),
  familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  ageGroup: ageGroupEnum("age_group").notNull().default("adult"),
});

export const eventInvites = pgTable("event_invites", {
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.eventId, t.familyId] })]);

export const rsvps = pgTable("rsvps", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  status: rsvpStatusEnum("status").notNull(),
  headcount: integer("headcount").notNull().default(0),
  note: text("note"),
  respondedAt: timestamp("responded_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("rsvp_event_family").on(t.eventId, t.familyId)]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: roleEnum("role").notNull(),
  weddingId: uuid("wedding_id").references(() => weddings.id), // null for admin = all weddings
  emailVerified: timestamp("email_verified", { withTimezone: true }), // Auth.js adapter field
});

export const emailLog = pgTable("email_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  type: emailTypeEnum("type").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  status: text("status").notNull(), // "sent" | "failed: <message>"
});
```

(Auth.js adapter also needs `accounts`, `sessions`, `verificationTokens` tables — add them in Task 8 with the adapter, not now. YAGNI until then.)

- [ ] **Step 4: Write `src/db/client.ts`**

```ts
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

function makeDb() {
  if (url) return drizzleNeon(neon(url), { schema });
  // Embedded Postgres for local dev/tests. In-memory when VITEST, on-disk otherwise.
  const pglite = new PGlite(process.env.VITEST ? undefined : "var/pglite");
  return drizzlePglite(pglite, { schema });
}

// Survive Next.js hot reload without piling up connections
const g = globalThis as unknown as { __db?: ReturnType<typeof makeDb> };
export const db = (g.__db ??= makeDb());

export async function migrateDb() {
  const { migrate } = url
    ? await import("drizzle-orm/neon-http/migrator")
    : await import("drizzle-orm/pglite/migrator");
  // Both migrators share this call signature
  await (migrate as any)(db, { migrationsFolder: "drizzle" });
}
```

- [ ] **Step 5: Write `drizzle.config.ts` and generate migrations**

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://unused" },
});
```

Run: `npx drizzle-kit generate`
Expected: SQL migration file appears under `drizzle/`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: drizzle schema, pglite/neon client, initial migration"
```

---

### Task 3: Guest invite tokens

**Files:**
- Create: `src/lib/tokens.ts`
- Test: `tests/unit/tokens.test.ts`

**Interfaces:**
- Produces: `generateInviteToken(): { token: string; tokenHash: string }` (token is 43-char base64url of 32 bytes); `hashToken(token: string): string` (hex SHA-256); `tokenExpiry(weddingDate: Date): Date` (wedding + 7 days); `isExpired(expiresAt: Date | null, now?: Date): boolean` (null → expired).

- [ ] **Step 1: Write failing test `tests/unit/tokens.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { generateInviteToken, hashToken, tokenExpiry, isExpired } from "@/lib/tokens";

describe("invite tokens", () => {
  it("generates 32-byte base64url tokens with matching hash", () => {
    const { token, tokenHash } = generateInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates unique tokens", () => {
    expect(generateInviteToken().token).not.toBe(generateInviteToken().token);
  });

  it("expiry is wedding date + 7 days", () => {
    const d = tokenExpiry(new Date("2026-11-20T00:00:00Z"));
    expect(d.toISOString()).toBe("2026-11-27T00:00:00.000Z");
  });

  it("isExpired handles past, future, and null", () => {
    const now = new Date("2026-07-12T00:00:00Z");
    expect(isExpired(new Date("2026-07-11T00:00:00Z"), now)).toBe(true);
    expect(isExpired(new Date("2026-07-13T00:00:00Z"), now)).toBe(false);
    expect(isExpired(null, now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tokens.test.ts`
Expected: FAIL — cannot resolve `@/lib/tokens`.

- [ ] **Step 3: Write `src/lib/tokens.ts`**

```ts
import { randomBytes, createHash } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function tokenExpiry(weddingDate: Date): Date {
  return new Date(weddingDate.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return !expiresAt || expiresAt.getTime() <= now.getTime();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tokens.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: invite token generate/hash/expiry"
```

---

### Task 4: Rate limiter

**Files:**
- Create: `src/lib/ratelimit.ts`
- Test: `tests/unit/ratelimit.test.ts`

**Interfaces:**
- Produces: `rateLimit(key: string, opts?: { max?: number; windowMs?: number }): boolean` — true = allowed. Defaults max=20, windowMs=60_000. In-memory sliding window (per-serverless-instance is an accepted MVP limitation, per spec §6).

- [ ] **Step 1: Write failing test `tests/unit/ratelimit.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/ratelimit";

describe("rateLimit", () => {
  it("allows up to max hits then blocks within the window", () => {
    for (let i = 0; i < 5; i++) expect(rateLimit("k1", { max: 5 })).toBe(true);
    expect(rateLimit("k1", { max: 5 })).toBe(false);
  });

  it("tracks keys independently", () => {
    expect(rateLimit("k2", { max: 1 })).toBe(true);
    expect(rateLimit("k3", { max: 1 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**, then **Step 3: Write `src/lib/ratelimit.ts`**

```ts
const hits = new Map<string, number[]>();

export function rateLimit(
  key: string,
  { max = 20, windowMs = 60_000 }: { max?: number; windowMs?: number } = {},
): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
  return true;
}
```

- [ ] **Step 4: Run to verify PASS**, then **Step 5: Commit** (`feat: in-memory rate limiter`).

---

### Task 5: Mailer + invite email template

**Files:**
- Create: `src/lib/mailer.ts`, `src/emails/InviteEmail.tsx`
- Test: `tests/unit/mailer.test.ts`

**Interfaces:**
- Consumes: `emailLog` table (Task 2).
- Produces: `sendInvite(args: { familyId: string; to: string; familyName: string; coupleNames: string; rsvpUrl: string; theme: string; type: "invite" | "reminder" | "resend" }): Promise<{ ok: boolean; error?: string }>` — renders InviteEmail, sends via transport chosen by `EMAIL_MODE`, always writes an `emailLog` row. `file` mode appends one JSON line `{to, subject, html, rsvpUrl}` to `var/outbox/mail.jsonl` (e2e tests read tokens from here).

- [ ] **Step 1: Write failing test `tests/unit/mailer.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import { db, migrateDb } from "@/db/client";
import { weddings, families, emailLog } from "@/db/schema";
import { sendInvite } from "@/lib/mailer";

describe("sendInvite (file mode)", () => {
  beforeAll(async () => {
    process.env.EMAIL_MODE = "file";
    await migrateDb();
  });

  it("writes outbox line and email_log row", async () => {
    const [w] = await db.insert(weddings).values({
      slug: "m1", brideName: "Ananya", groomName: "Arjun",
      theme: "ivory-editorial", weddingDate: new Date("2026-11-20"),
    }).returning();
    const [f] = await db.insert(families).values({
      weddingId: w.id, name: "Mehta Family", side: "groom", email: "mehta@example.com",
    }).returning();

    const res = await sendInvite({
      familyId: f.id, to: f.email, familyName: f.name,
      coupleNames: "Ananya & Arjun",
      rsvpUrl: "http://localhost:3000/rsvp/tok123", theme: w.theme, type: "invite",
    });

    expect(res.ok).toBe(true);
    const lines = fs.readFileSync("var/outbox/mail.jsonl", "utf8").trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.to).toBe("mehta@example.com");
    expect(last.rsvpUrl).toContain("/rsvp/tok123");
    expect(last.html).toContain("Mehta Family");
    const logs = await db.select().from(emailLog);
    expect(logs.some((l) => l.familyId === f.id && l.status === "sent")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Write `src/emails/InviteEmail.tsx`**

```tsx
import { Html, Head, Body, Container, Heading, Text, Button, Hr } from "@react-email/components";

const PALETTES: Record<string, { bg: string; accent: string; text: string }> = {
  "ivory-editorial": { bg: "#faf8f4", accent: "#e8930c", text: "#232323" },
  "raj-mahal": { bg: "#2a0a10", accent: "#d4a439", text: "#f5ead6" },
  "gulaab-rococo": { bg: "#fdf2f6", accent: "#c2447a", text: "#4a2b3a" },
};

export function InviteEmail(props: { familyName: string; coupleNames: string; rsvpUrl: string; theme: string }) {
  const p = PALETTES[props.theme] ?? PALETTES["ivory-editorial"];
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: p.bg, color: p.text, fontFamily: "Georgia, serif" }}>
        <Container style={{ padding: "40px 24px", textAlign: "center" as const }}>
          <Text style={{ letterSpacing: 4, textTransform: "uppercase" as const, fontSize: 12 }}>
            You are cordially invited
          </Text>
          <Heading style={{ fontSize: 34, margin: "16px 0" }}>{props.coupleNames}</Heading>
          <Hr style={{ borderColor: p.accent, width: 80 }} />
          <Text style={{ fontSize: 16 }}>
            Dear {props.familyName}, we would be honoured to celebrate with you.
            Please let us know who is coming.
          </Text>
          <Button href={props.rsvpUrl} style={{
            backgroundColor: p.accent, color: "#fff", padding: "14px 36px",
            borderRadius: 4, fontSize: 16, letterSpacing: 1,
          }}>
            RSVP
          </Button>
          <Text style={{ fontSize: 12, opacity: 0.7, marginTop: 24 }}>
            This link is personal to your family — feel free to share it within your household.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 4: Write `src/lib/mailer.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { render } from "@react-email/components";
import { db } from "@/db/client";
import { emailLog } from "@/db/schema";
import { InviteEmail } from "@/emails/InviteEmail";

type SendArgs = {
  familyId: string; to: string; familyName: string; coupleNames: string;
  rsvpUrl: string; theme: string; type: "invite" | "reminder" | "resend";
};

async function deliver(to: string, subject: string, html: string, rsvpUrl: string) {
  if (process.env.EMAIL_MODE === "smtp") {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
  } else {
    const dir = path.join(process.cwd(), "var/outbox");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "mail.jsonl"),
      JSON.stringify({ to, subject, html, rsvpUrl }) + "\n");
  }
}

export async function sendInvite(args: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const subject = `${args.coupleNames} — you're invited! Please RSVP`;
  const html = await render(InviteEmail(args));
  try {
    await deliver(args.to, subject, html, args.rsvpUrl);
    await db.insert(emailLog).values({ familyId: args.familyId, type: args.type, status: "sent" });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.insert(emailLog).values({ familyId: args.familyId, type: args.type, status: `failed: ${error}` });
    return { ok: false, error };
  }
}
```

- [ ] **Step 5: Run to verify PASS**, then **Step 6: Commit** (`feat: mailer with file/smtp transports and themed invite email`).

---

### Task 6: Seed script — "Ananya weds Arjun"

**Files:**
- Create: `scripts/seed.ts`; add `"seed": "tsx scripts/seed.ts"` to package.json scripts

**Interfaces:**
- Consumes: schema (Task 2), tokens (Task 3).
- Produces: idempotent seed (deletes wedding with slug `ananya-weds-arjun` then re-inserts): 1 wedding (2026-11-20, theme `ivory-editorial`, tagline + story copy), 5 events (Haldi, Mehendi, Sangeet, Pheras, Reception), 12 families / ~35 guests split across sides, event_invites (4 close-family households invited to all 5; the rest to Sangeet/Pheras/Reception only), pre-seeded RSVPs for 7 families (mix of attending/declined) so dashboards look alive, and 4 staff users: 1 admin (Aadi), 1 couple, 2 committee. Prints each family's live RSVP URL to stdout for manual demo clicking.

- [ ] **Step 1: Write `scripts/seed.ts`**

```ts
import { db, migrateDb } from "@/db/client";
import { weddings, events, families, guests, eventInvites, rsvps, users } from "@/db/schema";
import { generateInviteToken, tokenExpiry } from "@/lib/tokens";
import { eq } from "drizzle-orm";

const WEDDING_DATE = new Date("2026-11-20T10:00:00+05:30");

const EVENTS = [
  { name: "Haldi", startsAt: "2026-11-18T10:00:00+05:30", venueName: "Sharma Residence", address: "12 Rose Villa, Juhu, Mumbai", dressCode: "Yellows", sortOrder: 0 },
  { name: "Mehendi", startsAt: "2026-11-18T16:00:00+05:30", venueName: "Sharma Residence", address: "12 Rose Villa, Juhu, Mumbai", dressCode: "Greens & florals", sortOrder: 1 },
  { name: "Sangeet", startsAt: "2026-11-19T19:00:00+05:30", venueName: "The Regal Ballroom, Taj Lands End", address: "Bandstand, Bandra West, Mumbai", dressCode: "Cocktail / Indo-western", sortOrder: 2 },
  { name: "Pheras", startsAt: "2026-11-20T10:00:00+05:30", venueName: "ISKCON Temple Lawns", address: "Hare Krishna Land, Juhu, Mumbai", dressCode: "Traditional", sortOrder: 3 },
  { name: "Reception", startsAt: "2026-11-20T19:30:00+05:30", venueName: "Grand Hyatt Ballroom", address: "Santacruz East, Mumbai", dressCode: "Formal", sortOrder: 4 },
];

// [familyName, side, relation, email, memberNames, closeFamily?]
const FAMILIES: [string, "bride" | "groom" | "both", string, string, string[], boolean][] = [
  ["Sharma Family", "bride", "Ananya's parents", "sharma@example.com", ["Rajesh Sharma", "Sunita Sharma"], true],
  ["Mehta Family", "groom", "Arjun's parents", "mehta@example.com", ["Vikram Mehta", "Kavita Mehta"], true],
  ["Nani's House", "bride", "Maternal grandparents", "nani@example.com", ["Shakuntala Devi", "Ram Prasad"], true],
  ["Chachu & Family", "groom", "Arjun's uncle", "chachu@example.com", ["Rohit Mehta", "Neha Mehta", "Aarav Mehta", "Myra Mehta"], true],
  ["Mama's Family", "bride", "Ananya's mama", "mama@example.com", ["Suresh Rao", "Lakshmi Rao", "Dev Rao"], false],
  ["Bua's Family", "groom", "Arjun's bua", "bua@example.com", ["Meena Kapoor", "Anil Kapoor", "Riya Kapoor"], false],
  ["The Iyers", "bride", "Family friends", "iyer@example.com", ["Krishnan Iyer", "Padma Iyer"], false],
  ["The Khans", "groom", "College friends", "khan@example.com", ["Zoya Khan", "Imran Khan"], false],
  ["The Guptas", "both", "Neighbours", "gupta@example.com", ["Manoj Gupta", "Rekha Gupta", "Tanvi Gupta"], false],
  ["Ananya's Office Gang", "bride", "Colleagues", "office-a@example.com", ["Priya Nair", "Kabir Bose", "Ishaan Verma"], false],
  ["Arjun's Batchmates", "groom", "IIT hostel wing", "batch@example.com", ["Aditya Singh", "Ravi Teja", "Nikhil Jain", "Sameer Kulkarni"], false],
  ["The D'Souzas", "both", "Childhood friends", "dsouza@example.com", ["Maria D'Souza", "Kevin D'Souza"], false],
];

async function main() {
  await migrateDb();
  const existing = await db.select().from(weddings).where(eq(weddings.slug, "ananya-weds-arjun"));
  if (existing[0]) await db.delete(weddings).where(eq(weddings.id, existing[0].id));

  const [w] = await db.insert(weddings).values({
    slug: "ananya-weds-arjun", brideName: "Ananya", groomName: "Arjun",
    theme: "ivory-editorial", weddingDate: WEDDING_DATE,
    heroTagline: "Two families, five celebrations, one big yes.",
    story: "They met over a spilled filter coffee at a Bengaluru hackathon in 2021. Four years, two cities and one very persistent golden retriever later — here we are.",
  }).returning();

  const evs = await db.insert(events).values(
    EVENTS.map((e) => ({ ...e, weddingId: w.id, startsAt: new Date(e.startsAt) })),
  ).returning();
  const mainThree = evs.filter((e) => ["Sangeet", "Pheras", "Reception"].includes(e.name));

  for (const [name, side, relation, email, members, close] of FAMILIES) {
    const { token, tokenHash } = generateInviteToken();
    const [f] = await db.insert(families).values({
      weddingId: w.id, name, side, relation, email,
      inviteTokenHash: tokenHash, tokenExpiresAt: tokenExpiry(WEDDING_DATE),
    }).returning();
    await db.insert(guests).values(members.map((m) => ({ familyId: f.id, fullName: m })));
    const invited = close ? evs : mainThree;
    await db.insert(eventInvites).values(invited.map((e) => ({ eventId: e.id, familyId: f.id })));
    // Pre-seed RSVPs for the first 7 families so dashboards look alive
    const idx = FAMILIES.findIndex((x) => x[0] === name);
    if (idx < 7) {
      await db.insert(rsvps).values(invited.map((e, i) => ({
        eventId: e.id, familyId: f.id,
        status: (idx === 5 && i > 0 ? "declined" : "attending") as "attending" | "declined",
        headcount: idx === 5 && i > 0 ? 0 : members.length,
        note: idx === 2 ? "Nani needs a wheelchair-friendly seat" : null,
      })));
    }
    console.log(`${name}: ${process.env.APP_URL ?? "http://localhost:3000"}/rsvp/${token}`);
  }

  await db.insert(users).values([
    { email: "aadi@example.com", name: "Aadi", role: "admin" },
    { email: "couple@example.com", name: "Ananya", role: "couple", weddingId: w.id },
    { email: "committee1@example.com", name: "Rohit (Chachu)", role: "committee", weddingId: w.id },
    { email: "committee2@example.com", name: "Wedding Planner", role: "committee", weddingId: w.id },
  ]);
  console.log("Seeded ananya-weds-arjun ✔");
}

main().then(() => process.exit(0));
```

(Before the demo, replace the `@example.com` staff emails with the four founders' real addresses so magic-link sign-in works.)

- [ ] **Step 2: Run and verify**

Run: `npx tsx --env-file=.env scripts/seed.ts` (create `.env` from `.env.example` first)
Expected: 12 RSVP URLs printed + "Seeded ananya-weds-arjun ✔". Run twice — second run must not error (idempotency).

- [ ] **Step 3: Commit** (`feat: demo seed — ananya-weds-arjun with families, invites, rsvps, staff`).

---

### Task 7: RSVP data layer

**Files:**
- Create: `src/lib/rsvp.ts`
- Test: `tests/unit/rsvp.test.ts`

**Interfaces:**
- Consumes: schema, tokens, ratelimit.
- Produces:
  - `getFamilyByToken(token: string): Promise<null | { family: {id,name,side,relation}; wedding: {id,slug,brideName,groomName,theme,weddingDate}; members: {id,fullName,ageGroup}[]; events: {id,name,startsAt,venueName,address,mapUrl,dressCode, rsvp: null | {status,headcount,note}}[] }>` — null on unknown/expired token. Events = only those the family is invited to, sorted by sortOrder.
  - `submitRsvp(input: { token: string; responses: { eventId: string; status: "attending" | "declined"; headcount: number; note?: string }[] }, clientKey?: string): Promise<{ ok: true } | { ok: false; error: string }>` — Zod-validated; rejects: bad/expired token (`"invalid token"`), rate limit (`"too many requests"`), event not in family's invites (`"not invited to event"`), attending with headcount < 1 or > members+2 (`"headcount out of range"`). Declined forces headcount 0. Upserts on (eventId, familyId).
  - `getRsvpSummary(weddingId: string): Promise<{ eventId: string; eventName: string; invitedFamilies: number; responded: number; attendingHeadcount: number }[]>` — used by all three dashboards.

- [ ] **Step 1: Write failing test `tests/unit/rsvp.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { db, migrateDb } from "@/db/client";
import { weddings, events, families, guests, eventInvites } from "@/db/schema";
import { generateInviteToken, tokenExpiry } from "@/lib/tokens";
import { getFamilyByToken, submitRsvp, getRsvpSummary } from "@/lib/rsvp";

let token: string, eventA: string, eventB: string, weddingId: string;

beforeAll(async () => {
  await migrateDb();
  const [w] = await db.insert(weddings).values({
    slug: "r1", brideName: "A", groomName: "B",
    theme: "raj-mahal", weddingDate: new Date("2026-11-20"),
  }).returning();
  weddingId = w.id;
  const [e1] = await db.insert(events).values({ weddingId, name: "Sangeet", startsAt: new Date(), venueName: "V", address: "X", sortOrder: 0 }).returning();
  const [e2] = await db.insert(events).values({ weddingId, name: "Pheras", startsAt: new Date(), venueName: "V", address: "X", sortOrder: 1 }).returning();
  eventA = e1.id; eventB = e2.id;
  const t = generateInviteToken(); token = t.token;
  const [f] = await db.insert(families).values({
    weddingId, name: "Rao Family", side: "bride", email: "rao@example.com",
    inviteTokenHash: t.tokenHash, tokenExpiresAt: tokenExpiry(w.weddingDate),
  }).returning();
  await db.insert(guests).values([
    { familyId: f.id, fullName: "P Rao" }, { familyId: f.id, fullName: "Q Rao" },
  ]);
  await db.insert(eventInvites).values([{ eventId: eventA, familyId: f.id }]); // invited to Sangeet only
});

describe("getFamilyByToken", () => {
  it("returns family with only invited events", async () => {
    const res = await getFamilyByToken(token);
    expect(res?.family.name).toBe("Rao Family");
    expect(res?.events.map((e) => e.name)).toEqual(["Sangeet"]);
    expect(res?.members).toHaveLength(2);
  });
  it("returns null for unknown token", async () => {
    expect(await getFamilyByToken("nope")).toBeNull();
  });
});

describe("submitRsvp", () => {
  it("rejects events the family is not invited to", async () => {
    const res = await submitRsvp({ token, responses: [{ eventId: eventB, status: "attending", headcount: 2 }] });
    expect(res).toEqual({ ok: false, error: "not invited to event" });
  });
  it("rejects out-of-range headcount (members+2 max)", async () => {
    const res = await submitRsvp({ token, responses: [{ eventId: eventA, status: "attending", headcount: 5 }] });
    expect(res).toEqual({ ok: false, error: "headcount out of range" });
  });
  it("accepts a valid RSVP and upserts on resubmit", async () => {
    expect((await submitRsvp({ token, responses: [{ eventId: eventA, status: "attending", headcount: 2, note: "veg" }] })).ok).toBe(true);
    expect((await submitRsvp({ token, responses: [{ eventId: eventA, status: "declined", headcount: 3 }] })).ok).toBe(true);
    const fam = await getFamilyByToken(token);
    expect(fam?.events[0].rsvp).toMatchObject({ status: "declined", headcount: 0 }); // declined forces 0
    const summary = await getRsvpSummary(weddingId);
    expect(summary.find((s) => s.eventId === eventA)).toMatchObject({ invitedFamilies: 1, responded: 1, attendingHeadcount: 0 });
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Write `src/lib/rsvp.ts`**

```ts
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, events, families, guests, eventInvites, rsvps } from "@/db/schema";
import { hashToken, isExpired } from "@/lib/tokens";
import { rateLimit } from "@/lib/ratelimit";

export async function getFamilyByToken(token: string) {
  const [family] = await db.select().from(families)
    .where(eq(families.inviteTokenHash, hashToken(token)));
  if (!family || isExpired(family.tokenExpiresAt)) return null;

  const [wedding] = await db.select().from(weddings).where(eq(weddings.id, family.weddingId));
  const members = await db.select().from(guests).where(eq(guests.familyId, family.id));
  const invites = await db.select().from(eventInvites).where(eq(eventInvites.familyId, family.id));
  const eventIds = invites.map((i) => i.eventId);
  const evs = eventIds.length
    ? await db.select().from(events).where(inArray(events.id, eventIds)).orderBy(events.sortOrder)
    : [];
  const existing = await db.select().from(rsvps).where(eq(rsvps.familyId, family.id));

  return {
    family: { id: family.id, name: family.name, side: family.side, relation: family.relation },
    wedding: { id: wedding.id, slug: wedding.slug, brideName: wedding.brideName, groomName: wedding.groomName, theme: wedding.theme, weddingDate: wedding.weddingDate },
    members: members.map((m) => ({ id: m.id, fullName: m.fullName, ageGroup: m.ageGroup })),
    events: evs.map((e) => {
      const r = existing.find((x) => x.eventId === e.id);
      return { id: e.id, name: e.name, startsAt: e.startsAt, venueName: e.venueName, address: e.address, mapUrl: e.mapUrl, dressCode: e.dressCode,
        rsvp: r ? { status: r.status, headcount: r.headcount, note: r.note } : null };
    }),
  };
}

const submitSchema = z.object({
  token: z.string().min(20),
  responses: z.array(z.object({
    eventId: z.string().uuid(),
    status: z.enum(["attending", "declined"]),
    headcount: z.number().int().min(0).max(50),
    note: z.string().max(500).optional(),
  })).min(1),
});

export async function submitRsvp(input: unknown, clientKey = "local"):
  Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const { token, responses } = parsed.data;

  if (!rateLimit(`rsvp:${clientKey}`) || !rateLimit(`rsvp:tok:${token.slice(0, 12)}`))
    return { ok: false, error: "too many requests" };

  const fam = await getFamilyByToken(token);
  if (!fam) return { ok: false, error: "invalid token" };

  const invitedIds = new Set(fam.events.map((e) => e.id));
  const maxHeadcount = fam.members.length + 2;
  for (const r of responses) {
    if (!invitedIds.has(r.eventId)) return { ok: false, error: "not invited to event" };
    if (r.status === "attending" && (r.headcount < 1 || r.headcount > maxHeadcount))
      return { ok: false, error: "headcount out of range" };
  }

  for (const r of responses) {
    const headcount = r.status === "declined" ? 0 : r.headcount;
    await db.insert(rsvps)
      .values({ eventId: r.eventId, familyId: fam.family.id, status: r.status, headcount, note: r.note })
      .onConflictDoUpdate({
        target: [rsvps.eventId, rsvps.familyId],
        set: { status: r.status, headcount, note: r.note ?? null, respondedAt: new Date() },
      });
  }
  return { ok: true };
}

export async function getRsvpSummary(weddingId: string) {
  const evs = await db.select().from(events).where(eq(events.weddingId, weddingId)).orderBy(events.sortOrder);
  const out = [];
  for (const e of evs) {
    const invited = await db.select({ n: sql<number>`count(*)::int` }).from(eventInvites).where(eq(eventInvites.eventId, e.id));
    const resp = await db.select({
      n: sql<number>`count(*)::int`,
      heads: sql<number>`coalesce(sum(case when status = 'attending' then headcount else 0 end), 0)::int`,
    }).from(rsvps).where(eq(rsvps.eventId, e.id));
    out.push({ eventId: e.id, eventName: e.name, invitedFamilies: invited[0].n, responded: resp[0].n, attendingHeadcount: resp[0].heads });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify PASS** (`npx vitest run tests/unit/rsvp.test.ts`), then run the full suite (`npx vitest run`) — all green.

- [ ] **Step 5: Commit** (`feat: rsvp data layer — token lookup, validated submit, summary`).

---

### Task 8: Staff auth (Auth.js v5)

**Files:**
- Create: `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`, `src/lib/authz.ts`, `src/app/signin/page.tsx`
- Modify: `src/db/schema.ts` (add Auth.js adapter tables), regenerate migration
- Test: `tests/unit/authz.test.ts`

**Interfaces:**
- Consumes: `users` table, mailer transport pattern (magic-link mail also honours `EMAIL_MODE=file` → outbox).
- Produces: `auth()` (session getter), `signIn`/`signOut`; `requireRole(allowed: ("admin"|"couple"|"committee")[]): Promise<{ userId: string; role: Role; weddingId: string | null }>` from `@/lib/authz` — throws redirect to `/signin` when unauthenticated, throws `Error("forbidden")` when role not allowed. Session shape: `session.user.role`, `session.user.weddingId`.
- Middleware protects `/couple`, `/committee`, `/admin` route groups (redirect to `/signin`); fine-grained role checks stay in `requireRole` calls inside pages/actions.

- [ ] **Step 1: Add adapter tables to `src/db/schema.ts`** (append)

```ts
export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);
```

Run: `npx drizzle-kit generate` → new migration file.

- [ ] **Step 2: Write `src/auth.ts`**

```ts
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import fs from "node:fs";
import path from "node:path";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users as any, accountsTable: accounts as any,
    sessionsTable: sessions as any, verificationTokensTable: verificationTokens as any,
  }),
  providers: [
    Nodemailer({
      server: { service: "gmail", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } },
      from: process.env.EMAIL_FROM,
      // file mode: write the magic link to the outbox instead of sending
      ...(process.env.EMAIL_MODE !== "smtp" && {
        sendVerificationRequest: async ({ identifier, url }) => {
          const dir = path.join(process.cwd(), "var/outbox");
          fs.mkdirSync(dir, { recursive: true });
          fs.appendFileSync(path.join(dir, "mail.jsonl"),
            JSON.stringify({ to: identifier, subject: "Sign in", signInUrl: url }) + "\n");
        },
      }),
    }),
  ],
  callbacks: {
    // No self-signup: only pre-provisioned staff emails may sign in
    async signIn({ user }) {
      if (!user.email) return false;
      const [existing] = await db.select().from(users).where(eq(users.email, user.email));
      return !!existing;
    },
    async session({ session, user }) {
      const [row] = await db.select().from(users).where(eq(users.id, user.id));
      (session.user as any).role = row?.role;
      (session.user as any).weddingId = row?.weddingId ?? null;
      return session;
    },
  },
  pages: { signIn: "/signin" },
});
```

- [ ] **Step 3: Write route handler, middleware, authz helper**

`src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

`src/middleware.ts`:

```ts
export { auth as middleware } from "@/auth";
export const config = { matcher: ["/couple/:path*", "/committee/:path*", "/admin/:path*"] };
```

(Auth.js default behaviour redirects unauthenticated matches to the sign-in page.)

`src/lib/authz.ts`:

```ts
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type Role = "admin" | "couple" | "committee";

export async function requireRole(allowed: Role[]) {
  const session = await auth();
  const u = session?.user as ({ id: string; role?: Role; weddingId?: string | null } | undefined);
  if (!u?.role) redirect("/signin");
  if (!allowed.includes(u.role)) throw new Error("forbidden");
  return { userId: u.id, role: u.role, weddingId: u.weddingId ?? null };
}
```

`src/app/signin/page.tsx` — minimal email form posting to `signIn("nodemailer", { email })` via a server action; shows "check your email" state. Style comes later with the theme pass.

- [ ] **Step 4: Write `tests/unit/authz.test.ts`** — test the signIn callback logic in isolation (extract it as `export async function isProvisionedStaff(email: string | null | undefined)` in `src/auth.ts` that the callback calls; test: provisioned email → true, unknown email → false, null → false). Run: FAIL → implement → PASS.

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { db, migrateDb } from "@/db/client";
import { users } from "@/db/schema";
import { isProvisionedStaff } from "@/auth";

describe("isProvisionedStaff", () => {
  beforeAll(async () => {
    await migrateDb();
    await db.insert(users).values({ email: "staff@example.com", role: "committee" }).onConflictDoNothing();
  });
  it("allows provisioned, rejects unknown and null", async () => {
    expect(await isProvisionedStaff("staff@example.com")).toBe(true);
    expect(await isProvisionedStaff("stranger@example.com")).toBe(false);
    expect(await isProvisionedStaff(null)).toBe(false);
  });
});
```

(Importing `src/auth.ts` in vitest pulls in NextAuth; if that import is heavy/breaks under vitest, move `isProvisionedStaff` to `src/lib/authz.ts` and import it into `auth.ts` — keep the test pointing at the extracted function.)

- [ ] **Step 5: Manual smoke** — `npm run dev`, visit `/admin` signed out → redirected to `/signin`; request link for the seeded admin email; with `EMAIL_MODE=file` grab `signInUrl` from `var/outbox/mail.jsonl`, open it, land signed in; `/admin` now renders (blank page is fine at this task).

- [ ] **Step 6: Commit** (`feat: staff auth — Auth.js magic links, no self-signup, role middleware`).

---

### Task 9: Public wedding site `/w/[slug]`

**Files:**
- Create: `src/app/w/[slug]/page.tsx`, `src/lib/wedding.ts`, section components under `src/app/w/[slug]/sections/` (`Hero.tsx`, `Story.tsx`, `EventTimeline.tsx`, `TravelStay.tsx`, `Gallery.tsx`, `RsvpCta.tsx`)
- Test: build + manual; e2e covers it in Task 15

**Interfaces:**
- Consumes: schema.
- Produces: `getWeddingBySlug(slug: string)` in `src/lib/wedding.ts` → `{ wedding, events }` or null (404 via `notFound()`). Page root element sets `data-theme={wedding.theme}` — the single hook the theme system (Task 10) attaches to.

**REQUIRED SUB-SKILL for this task: frontend-design.** Build the page on the `ivory-editorial` look first (ivory `#faf8f4`, charcoal, single marigold accent, oversized display serif headings, hairline rules, generous whitespace). Structure must be theme-agnostic: section components take data props only; all visual identity comes from CSS variables + per-theme ornament slots.

- [ ] **Step 1: Write `src/lib/wedding.ts`**

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, events } from "@/db/schema";

export async function getWeddingBySlug(slug: string) {
  const [wedding] = await db.select().from(weddings).where(eq(weddings.slug, slug));
  if (!wedding) return null;
  const evs = await db.select().from(events)
    .where(eq(events.weddingId, wedding.id)).orderBy(events.sortOrder);
  return { wedding, events: evs };
}
```

- [ ] **Step 2: Build the page + sections (frontend-design skill).** Required content: Hero (couple names, tagline, date, countdown-free — dates speak for themselves); Story; EventTimeline (each event: name, date/time formatted for Asia/Kolkata, venue, address, map link if present, dress code); TravelStay (static copy block for demo: two hotel suggestions + airport note); Gallery (6–8 seeded images from `public/gallery/` — use tasteful royalty-free Indian wedding photos or generated placeholders, NOT stock-watermarked); RsvpCta (copy: "Got your invite email? Your RSVP link is inside." — no public RSVP entry, that's token-only by design).

- [ ] **Step 3: Verify** — `npm run build` green; `/w/ananya-weds-arjun` renders all sections with seeded data; Lighthouse-level sanity (no layout shift, mobile viewport clean at 390px).

- [ ] **Step 4: Commit** (`feat: public themed wedding site — ivory-editorial base`).

---

### Task 10: Theme system + Raj Mahal + Gulaab Rococo

**Files:**
- Create: `src/themes/tokens.css` (all three `[data-theme=...]` variable blocks), `src/themes/ornaments.tsx` (per-theme hero frames / section dividers as inline SVG components keyed by theme), font setup in `src/app/layout.tsx` via `next/font/google`
- Modify: section components to consume variables/ornament slots only
- Test: visual pass + build

**Interfaces:**
- Consumes: `data-theme` hook from Task 9.
- Produces: CSS variables every themed surface uses: `--bg`, `--surface`, `--ink`, `--accent`, `--accent-2`, `--font-display`, `--font-body`, plus `Ornament({ theme, slot })` component with slots `"hero" | "divider"`. Fonts: Cormorant Garamond (raj-mahal display), Fraunces (gulaab-rococo display), one modern display serif for ivory-editorial (choose in-task), Inter body for all.

**REQUIRED SUB-SKILL: frontend-design.** Palette contract (from spec §7):
- `raj-mahal`: deep maroon `#4a0e1c` bg family, gold `#d4a439`, indigo accents; Mughal jaali-arch hero frame, jaali lattice divider.
- `gulaab-rococo`: blush/rani pink `#c2447a` on `#fdf2f6`, lavender secondary; watercolour floral corners, scalloped ornamental frames.
- `ivory-editorial`: already built — extract its hardcoded values into the token block, confirm zero visual regression.

- [ ] **Step 1: Extract ivory-editorial into `tokens.css`; verify `/w/ananya-weds-arjun` is pixel-identical.**
- [ ] **Step 2: Build raj-mahal tokens + ornaments; flip seeded wedding's theme in DB (`update weddings set theme='raj-mahal'`) and review.**
- [ ] **Step 3: Build gulaab-rococo tokens + ornaments; flip and review.**
- [ ] **Step 4: Verify InviteEmail palettes (Task 5) still match the three site themes; adjust hexes to the final values.**
- [ ] **Step 5: Commit per theme** (`feat: theme system + raj-mahal`, `feat: gulaab-rococo theme`).

---

### Task 11: Guest RSVP page `/rsvp/[token]`

**Files:**
- Create: `src/app/rsvp/[token]/page.tsx`, `src/app/rsvp/[token]/RsvpForm.tsx` (client component), `src/app/rsvp/actions.ts` (server action), invalid/expired state inline
- Test: covered by Task 7 unit tests + Task 15 e2e; manual pass here

**Interfaces:**
- Consumes: `getFamilyByToken`, `submitRsvp` (Task 7). Theme via `data-theme={wedding.theme}` (Task 10).
- Produces: `submitRsvpAction(formDataOrPayload)` server action wrapping `submitRsvp` with `clientKey` = caller IP from `headers()` (`x-forwarded-for` first hop, fallback `"local"`).

**REQUIRED SUB-SKILL: frontend-design.** This page is the guest's whole experience of the product — it must feel like the invite, not like a form.

- [ ] **Step 1: Page (server component):** token from params → `getFamilyByToken` → invalid/expired renders a warm apology + "ask the family to resend your link" (no fresh-link self-service in demo — committee resends; spec's request-fresh-link is production scope). Valid → greeting ("Dear Sharma Family"), the couple/date header, and `RsvpForm` with the family's events.
- [ ] **Step 2: `RsvpForm` (client):** one card per event — event name/date/venue, attending/declined toggle, headcount stepper (1..members+2, prefilled = member count) shown only when attending, shared note field. Prefill from existing `rsvp` values (revisit = edit). Submit → server action → success state ("See you at the Sangeet! You can change this anytime from the same link.").
- [ ] **Step 3: `src/app/rsvp/actions.ts`:**

```ts
"use server";
import { headers } from "next/headers";
import { submitRsvp } from "@/lib/rsvp";

export async function submitRsvpAction(input: {
  token: string;
  responses: { eventId: string; status: "attending" | "declined"; headcount: number; note?: string }[];
}) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  return submitRsvp(input, ip);
}
```

- [ ] **Step 4: Manual pass** with a seeded URL from `npm run seed` output: submit, revisit, edit, check DB. Try a garbage token → warm error page.
- [ ] **Step 5: Commit** (`feat: guest rsvp page — themed per-event form with edit-on-revisit`).

---

### Task 12: Committee view `/committee`

**Files:**
- Create: `src/app/committee/page.tsx`, `src/app/committee/actions.ts`, components `FamilyTable.tsx`, `FamilyForm.tsx` (add/edit family + members + event checkboxes, in a drawer/modal)
- Test: `tests/unit/committee-actions.test.ts` for the send-invites action logic; manual for UI

**Interfaces:**
- Consumes: `requireRole` (Task 8), mailer (Task 5), tokens (Task 3), `getRsvpSummary` (Task 7).
- Produces: server actions in `src/app/committee/actions.ts`, all opening with `const staff = await requireRole(["committee", "admin"])` and scoping every query to `staff.weddingId` (admin passes explicit weddingId):
  - `upsertFamily(input)` — Zod schema: family fields + `members: {fullName, ageGroup}[]` + `eventIds: string[]`; replaces members + event_invites on edit.
  - `sendInvites(familyIds: string[], type: "invite" | "resend" | "remind")` — per family: `invite`/`resend` → new token via `generateInviteToken()` + `tokenExpiry(wedding.weddingDate)`, persist hash (old token dies by overwrite), send mail with fresh URL; `remind` → requires a live unexpired token; since we store only hashes, remind also regenerates (document this in a code comment: hash-only storage means every send mints a fresh link; acceptable — old links keep working only until overwritten, and each mail contains a working one). Skip already-responded families for `remind`. Returns per-family `{familyId, ok, error?}`.
- Page shows: per-event headcount summary strip (from `getRsvpSummary`), family table (name, side, relation, email, #members, invited-event chips, RSVP status per event: ✓ n / ✗ / —, last email status from email_log with "failed — retry" button), Add Family button, checkbox multi-select → Send/Resend/Remind.

- [ ] **Step 1: TDD the `sendInvites` core** (extract as `src/lib/invites.ts` → `issueInvites(weddingId, familyIds, type)` so it's testable without auth): test with `EMAIL_MODE=file` that (a) token hash changes on resend, (b) outbox line contains a URL whose token verifies against the new hash, (c) `remind` skips a family that has responded to every invited event, (d) email_log rows written. Write test → FAIL → implement → PASS.
- [ ] **Step 2: Build actions (auth wrapper + Zod) and page UI.** Functional-clean styling (this is a tool, not the themed showpiece — shadcn-adjacent plain Tailwind is fine; keep it visually quiet and dense).
- [ ] **Step 3: Manual pass:** add a family with 3 members invited to 2 events → send invite → outbox has URL → open it → RSVP → committee table updates; force a failure (set `EMAIL_MODE=smtp` with bad creds) → status shows "failed — retry".
- [ ] **Step 4: Commit** (`feat: committee view — guest ops, invite sending, per-event totals`).

---

### Task 13: Couple view `/couple`

**Files:**
- Create: `src/app/couple/page.tsx`, `src/app/couple/actions.ts` (`setTheme`), components `SummaryCards.tsx`, `NonResponders.tsx`, `ThemeSwitcher.tsx`
- Test: manual + build (aggregates already unit-tested in Task 7)

**Interfaces:**
- Consumes: `requireRole(["couple", "admin"])`, `getRsvpSummary`, schema.
- Produces: `setTheme(theme)` server action — Zod enum of the three theme names, scoped to `staff.weddingId`, `revalidatePath("/w/[slug]")`.

- [ ] **Step 1: Build page:** headline stats (total attending headcount, response rate), per-event `SummaryCards`, `NonResponders` list (families with zero rsvps, with relation + side so the couple knows who to nudge via committee), read-only guest list grouped by side.
- [ ] **Step 2: `ThemeSwitcher`:** three theme swatch cards (mini palette + font preview), current highlighted; click → `setTheme` → link "view your site" to `/w/[slug]`. This is the demo's money moment — make the swatches gorgeous (frontend-design skill for this component).
- [ ] **Step 3: Manual pass:** switch all three themes, confirm public site changes instantly on reload.
- [ ] **Step 4: Commit** (`feat: couple dashboard — rsvp stats, non-responders, theme switcher`).

---

### Task 14: Admin view `/admin`

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/weddings/[id]/page.tsx`
- Test: manual + build

**Interfaces:**
- Consumes: `requireRole(["admin"])`, schema, `getRsvpSummary`.

- [ ] **Step 1: `/admin`:** wedding list (slug, couple, date, theme, #families, #responded) + links per wedding to `/w/[slug]`, and detail page. Wedding creation form deferred — seed script covers demo; note it as a production TODO in the page's empty state, not a dead button.
- [ ] **Step 2: `/admin/weddings/[id]`:** email log table (family, type, sent_at, status — failures highlighted), RSVP summary, staff user list for that wedding. "Open committee view" / "open couple view" links (admin role already passes both `requireRole` gates — that IS the impersonation mechanism; scoping note: actions must accept admin's explicit weddingId here).
- [ ] **Step 3: Manual pass + commit** (`feat: admin view — weddings overview and email log`).

---

### Task 15: E2E happy path

**Files:**
- Create: `tests/e2e/rsvp-flow.spec.ts`, `playwright.config.ts`; add `"e2e": "playwright test"` script

**Interfaces:**
- Consumes: the running app (`EMAIL_MODE=file`), seed script, outbox file.

- [ ] **Step 1: `playwright.config.ts`** — `webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, env: { EMAIL_MODE: "file" } }`, single chromium project.

- [ ] **Step 2: Write the spec** (spec §9 happy path, adapted: seed provides invites; we exercise guest → dashboards):

```ts
import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

test("guest RSVPs via emailed link; public site renders", async ({ page }) => {
  const out = execSync("npx tsx --env-file=.env scripts/seed.ts").toString();
  // "The Khans" is seed index 7 — outside the first 7 families that get pre-seeded
  // RSVPs, so this family starts un-responded (required for the prefill assertion below)
  const url = out.split("\n").find((l) => l.startsWith("The Khans:"))!.split(": ")[1].trim();

  await page.goto(url);
  await expect(page.getByText(/Khan/i)).toBeVisible();
  await expect(page.getByText(/Sangeet/i)).toBeVisible();

  // RSVP attending to the first event with headcount 2, decline the second
  const cards = page.getByTestId("event-card");
  await cards.nth(0).getByRole("button", { name: /attending/i }).click();
  await cards.nth(1).getByRole("button", { name: /decline/i }).click();
  await page.getByRole("button", { name: /send rsvp/i }).click();
  await expect(page.getByText(/see you/i)).toBeVisible();

  // Revisit link → previous answers prefilled
  await page.goto(url);
  await expect(cards.nth(0).getByRole("button", { name: /attending/i })).toHaveAttribute("aria-pressed", "true");

  // Public site renders themed sections
  await page.goto("http://localhost:3000/w/ananya-weds-arjun");
  await expect(page.getByText(/Ananya/i).first()).toBeVisible();
  await expect(page.getByText(/Reception/i)).toBeVisible();
});
```

(Requires `data-testid="event-card"` and `aria-pressed` on the toggle buttons in `RsvpForm` — add them in Task 11 if missed. Staff-dashboard e2e assertions need magic-link session automation; the unit-tested `getRsvpSummary` + manual pass covers that for demo timeline — note as production TODO.)

- [ ] **Step 3: Run** `npx playwright install chromium && npm run e2e` → PASS. **Step 4: Commit** (`test: e2e guest rsvp happy path`).

---

### Task 16: Deploy + demo prep

**Files:**
- Create: `docs/DEMO-RUNBOOK.md`
- Modify: `.env` values in Vercel dashboard

- [ ] **Step 1: Neon** — create free project, copy pooled `DATABASE_URL`; run `DATABASE_URL=... npx drizzle-kit migrate` then `DATABASE_URL=... APP_URL=https://<prod-url> EMAIL_MODE=file npx tsx scripts/seed.ts` (capture printed RSVP URLs into the runbook). Before seeding, swap the four staff emails in `scripts/seed.ts` to the founders' real addresses.
- [ ] **Step 2: Vercel** — `vercel` link + set env (`DATABASE_URL`, `AUTH_SECRET` fresh via `openssl rand -base64 33`, `APP_URL`, `EMAIL_MODE=smtp`, `SMTP_USER`, `SMTP_PASS` = Gmail app password created at myaccount.google.com/apppasswords, `EMAIL_FROM`), `vercel --prod`.
- [ ] **Step 3: Production smoke** — sign in via real magic-link email as admin; committee → select 2 families whose email you rewrite to founder addresses → Send invites → real Gmail inbox → click → RSVP on a phone → couple dashboard shows it → switch all 3 themes live.
- [ ] **Step 4: Write `docs/DEMO-RUNBOOK.md`** — demo script in order: (1) open `/w/ananya-weds-arjun` on raj-mahal, scroll; (2) "this is the email your guests get" — show real invite in Gmail; (3) RSVP live from a phone; (4) couple dashboard — watch the number tick up; (5) the theme switch moment; (6) committee view — "your planner manages everything here"; (7) pricing conversation. Include: seeded RSVP URLs, staff sign-in emails, fallback plan (local dev server + file outbox) if Gmail acts up on the day.
- [ ] **Step 5: Commit** (`docs: demo runbook`) and tag `demo-v1`.

---

## Task → day mapping (10-day clock, buffer built in)

| Days | Tasks |
|---|---|
| 1 | 1–4 (scaffold, schema, tokens, ratelimit) |
| 2 | 5–7 (mailer, seed, rsvp layer) |
| 3 | 8 (auth) |
| 4–5 | 9 (public site, ivory) + 11 (rsvp page) |
| 6–7 | 10 (two more themes — the risk item; fallback per spec §10: ship 2 themes, never 3 broken ones) |
| 8 | 12–13 (committee, couple) |
| 9 | 14–15 (admin, e2e) |
| 10 | 16 (deploy, smoke, runbook) + slack |
