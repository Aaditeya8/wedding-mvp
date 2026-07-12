import { db, migrateDb } from "@/db/client";
import { weddings, events, families, guests, eventInvites, rsvps, users } from "@/db/schema";
import { generateInviteToken, tokenExpiry } from "@/lib/tokens";
import { eq, inArray } from "drizzle-orm";

// Before the demo, replace these with the four founders' real addresses so magic-link sign-in works.
const STAFF_EMAILS = ["aadi@example.com", "couple@example.com", "committee1@example.com", "committee2@example.com"];

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
  // Staff users reference the wedding without cascade — remove them first for idempotency
  await db.delete(users).where(inArray(users.email, STAFF_EMAILS));
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
    { email: STAFF_EMAILS[0], name: "Aadi", role: "admin" as const },
    { email: STAFF_EMAILS[1], name: "Ananya", role: "couple" as const, weddingId: w.id },
    { email: STAFF_EMAILS[2], name: "Rohit (Chachu)", role: "committee" as const, weddingId: w.id },
    { email: STAFF_EMAILS[3], name: "Wedding Planner", role: "committee" as const, weddingId: w.id },
  ]);
  console.log("Seeded ananya-weds-arjun ✔");
}

main().then(() => process.exit(0));
