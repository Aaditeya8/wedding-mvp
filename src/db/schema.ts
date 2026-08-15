import { pgTable, pgEnum, text, integer, timestamp, uuid, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

export const themeEnum = pgEnum("theme", ["ivory-editorial", "raj-mahal", "gulaab-rococo", "mehfil-noor", "pichwai-bagh", "neel-chhapa"]);
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

export const emailLog = pgTable("email_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  familyId: uuid("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  type: emailTypeEnum("type").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  status: text("status").notNull(), // "sent" | "failed: <message>"
});
