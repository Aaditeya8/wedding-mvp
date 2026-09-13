import { closeDb, db, migrateDb } from "@/db/client";
import { weddings, events, families, guests, eventInvites, rsvps, users } from "@/db/schema";
import { generateInviteToken, tokenExpiry } from "@/lib/tokens";
import { eq, inArray, or } from "drizzle-orm";

// Seeded staff logins in role order: [admin, couple, committee, committee], plus a
// second couple for the second wedding. Override with SEED_STAFF_EMAILS (comma-separated,
// 5 entries) when you want real magic links — Gmail plus-aliases (you+couple@gmail.com…)
// let a single inbox receive every role's sign-in mail.
const DEFAULT_STAFF_EMAILS = [
  "admin@example.com",
  "couple@example.com",
  "committee@example.com",
  "planner@example.com",
  "couple2@example.com",
];
const OVERRIDE_EMAILS = process.env.SEED_STAFF_EMAILS?.split(",").map((e) => e.trim()) ?? [];
const STAFF_EMAILS = DEFAULT_STAFF_EMAILS.map((fallback, i) => OVERRIDE_EMAILS[i] || fallback);

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

// Second demo wedding — shows the platform is multi-tenant and carries the new themes.
const GK_WEDDING_DATE = new Date("2026-12-11T10:00:00+05:30");

const GK_EVENTS = [
  { name: "Mehendi", startsAt: "2026-12-09T16:00:00+05:30", venueName: "Malhotra Farmhouse", address: "Chattarpur, New Delhi", dressCode: "Greens", sortOrder: 0 },
  { name: "Sangeet", startsAt: "2026-12-10T19:00:00+05:30", venueName: "The Leela Palace Lawns", address: "Chanakyapuri, New Delhi", dressCode: "Shimmer & silk", sortOrder: 1 },
  { name: "Pheras", startsAt: "2026-12-11T10:00:00+05:30", venueName: "Jagmandir Island Palace", address: "Lake Pichola, Udaipur", dressCode: "Traditional", sortOrder: 2 },
  { name: "Reception", startsAt: "2026-12-11T19:30:00+05:30", venueName: "Taj Fateh Prakash Ballroom", address: "City Palace Road, Udaipur", dressCode: "Formal", sortOrder: 3 },
];

const GK_FAMILIES: [string, "bride" | "groom" | "both", string, string, string[], boolean][] = [
  ["Malhotra Family", "bride", "Karishma's parents", "malhotra@example.com", ["Deepak Malhotra", "Ritu Malhotra"], true],
  ["Saxena Family", "groom", "Gaurav's parents", "saxena@example.com", ["Ashok Saxena", "Poonam Saxena"], true],
  ["Masi's Family", "bride", "Karishma's masi", "masi@example.com", ["Anita Chopra", "Vinod Chopra", "Sana Chopra"], true],
  ["Tau ji & Family", "groom", "Gaurav's tau ji", "tauji@example.com", ["Rakesh Saxena", "Usha Saxena", "Mohit Saxena"], false],
  ["The Bedis", "both", "Family friends", "bedi@example.com", ["Harpreet Bedi", "Simran Bedi"], false],
  ["Karishma's Design Studio", "bride", "Colleagues", "studio@example.com", ["Tara Menon", "Vivaan Shah", "Diya Paul"], false],
];

async function main() {
  await migrateDb();
  // The seed owns the two demo weddings and the staff logins it creates — and
  // nothing else. Couples who signed up themselves (and their weddings) survive
  // a re-seed, which matters once this runs against production.
  const demoSlugs = ["ananya-weds-arjun", "gaurav-weds-karishma"];
  const demo = await db.select({ id: weddings.id }).from(weddings).where(inArray(weddings.slug, demoSlugs));
  const demoIds = demo.map((w) => w.id);
  await db.delete(users).where(
    demoIds.length ? or(inArray(users.email, STAFF_EMAILS), inArray(users.weddingId, demoIds)) : inArray(users.email, STAFF_EMAILS),
  );
  if (demoIds.length) await db.delete(weddings).where(inArray(weddings.id, demoIds));

  const [w] = await db.insert(weddings).values({
    slug: "ananya-weds-arjun", brideName: "Ananya", groomName: "Arjun",
    theme: "ivory-editorial", weddingDate: WEDDING_DATE,
    heroTagline: "Two families, five celebrations, one big yes.",
    story: "They met over a spilled filter coffee at a Bengaluru hackathon in 2021. Four years, two cities and one very persistent golden retriever later — here we are.",
    city: "Mumbai", brideParents: "Sunita & Rajesh Sharma", groomParents: "Kavita & Vikram Mehta", hashtag: "AnanyaKaArjun",
    contactPhone: "+91 98200 00000 (Rohit)",
    travel: {
      stays: [
        { name: "Taj Lands End, Bandra", note: "Home of the Sangeet. A wedding block is reserved — mention the couple's names when booking." },
        { name: "Grand Hyatt, Santacruz", note: "The Reception happens under this roof, and it is the closest comfortable stay to the airport." },
      ],
      gettingThere: "Flying in? Land at Mumbai (BOM). Both hotels are 20–40 minutes from the terminals, and the Pheras venue in Juhu is a fifteen-minute drive from either — leave buffer for Mumbai traffic on the wedding morning.",
    },
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

  const [w2] = await db.insert(weddings).values({
    slug: "gaurav-weds-karishma", brideName: "Karishma", groomName: "Gaurav",
    theme: "pichwai-bagh", weddingDate: GK_WEDDING_DATE,
    heroTagline: "A Delhi love story, sealed on a lake in Udaipur.",
    story: "Matched by an aunty, ignored the aunty, then matched again by an app three years later. Some things are just written — this one twice.",
    city: "Udaipur", brideParents: "Ritu & Deepak Malhotra", groomParents: "Poonam & Ashok Saxena", hashtag: "GKForever",
    travel: {
      stays: [
        { name: "Taj Fateh Prakash Palace, Udaipur", note: "Home of the Reception, right on Lake Pichola. A wedding block is reserved — mention the couple's names when booking." },
        { name: "The Leela Palace, Udaipur", note: "A short boat ride from the Pheras at Jagmandir. Shuttles run to both wedding-day venues." },
      ],
      gettingThere: "The Delhi celebrations are at private venues — no stay needed. For the wedding days, fly into Udaipur (UDR), thirty minutes from the lake. The Pheras at Jagmandir Island are reached by boat from the City Palace jetty; departures start an hour before.",
    },
  }).returning();

  const gkEvs = await db.insert(events).values(
    GK_EVENTS.map((e) => ({ ...e, weddingId: w2.id, startsAt: new Date(e.startsAt) })),
  ).returning();
  const gkMain = gkEvs.filter((e) => ["Sangeet", "Pheras", "Reception"].includes(e.name));

  for (const [name, side, relation, email, members, close] of GK_FAMILIES) {
    const { token, tokenHash } = generateInviteToken();
    const [f] = await db.insert(families).values({
      weddingId: w2.id, name, side, relation, email,
      inviteTokenHash: tokenHash, tokenExpiresAt: tokenExpiry(GK_WEDDING_DATE),
    }).returning();
    await db.insert(guests).values(members.map((m) => ({ familyId: f.id, fullName: m })));
    const invited = close ? gkEvs : gkMain;
    await db.insert(eventInvites).values(invited.map((e) => ({ eventId: e.id, familyId: f.id })));
    // First 3 families pre-answered so the second dashboard isn't empty
    const idx = GK_FAMILIES.findIndex((x) => x[0] === name);
    if (idx < 3) {
      await db.insert(rsvps).values(invited.map((e) => ({
        eventId: e.id, familyId: f.id, status: "attending" as const, headcount: members.length,
      })));
    }
    console.log(`${name}: ${process.env.APP_URL ?? "http://localhost:3000"}/rsvp/${token}`);
  }

  await db.insert(users).values([
    { email: STAFF_EMAILS[0], name: "Aadi", role: "admin" as const },
    { email: STAFF_EMAILS[1], name: "Ananya", role: "couple" as const, weddingId: w.id },
    { email: STAFF_EMAILS[2], name: "Rohit (Chachu)", role: "committee" as const, weddingId: w.id },
    { email: STAFF_EMAILS[3], name: "Wedding Planner", role: "committee" as const, weddingId: w.id },
    { email: STAFF_EMAILS[4], name: "Karishma", role: "couple" as const, weddingId: w2.id },
  ]);
  console.log("Seeded ananya-weds-arjun + gaurav-weds-karishma ✔");
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

void run();
