import Link from "next/link";
import { Ornament } from "@/themes/ornaments";
import { BRAND, BRAND_TAGLINE } from "@/lib/brand";
import { EVENT_PRESETS } from "@/lib/presets";
import { ScrollFx } from "./w/[slug]/sections/ScrollFx";
import { Petals } from "./w/[slug]/sections/Petals";
import { SiteHeader } from "./home/SiteHeader";
import { LivePreview } from "./home/LivePreview";
import { RsvpDemo } from "./home/RsvpDemo";

export const metadata = {
  title: `${BRAND} — ${BRAND_TAGLINE}`,
  description:
    "A themed wedding invitation site for Indian weddings: every celebration, per-event RSVP, and one link to share on WhatsApp. Free while we're in pilot.",
};

/* A genuine sequence — a couple does these in this order — so it is numbered. */
const STEPS = [
  {
    title: "Tell us the basics",
    body: "Names, date, city, a look. Your site exists before you finish your chai, with Haldi, Mehendi, Sangeet, Pheras and Reception already on it.",
  },
  {
    title: "Fill in the venues",
    body: "Add a Roka or a Walima. Switch the family-only puja off the public page. Your parents' names, your story, hotels for the outstation guests.",
  },
  {
    title: "Send one link",
    body: "WhatsApp it, or print the QR on the card. Guests tap, see every celebration, and reply. You watch the numbers move.",
  },
];

const FEATURES: [string, string][] = [
  ["Answers, per celebration", "Coming to the Sangeet but not the Pheras? Guests answer each one separately, with a headcount and whether they eat veg, Jain or otherwise."],
  ["Nothing you can't hide", "The family-only puja stays off the shared link without being deleted — switch it back on for the people you post cards to."],
  ["Bring the list you already have", "Upload the spreadsheet, or photograph the handwritten one. We read it, ask about anything unclear, and never add the same family twice."],
  ["Someone else can run it", "Hand the guest list to your planner or the chachu who volunteers for everything. They get their own login; you keep the theme switcher."],
  ["Personal invitations too", "Each family can get their own emailed invite with a private RSVP link, sent under your names — alongside the open link for everyone else."],
  ["No app, no account", "Not for you and not for your grandmother. A link opens a page; that is the whole thing."],
];

export default function Home() {
  return (
    <div data-theme="ivory-editorial" className="themed flex-1">
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('fx')" }} />
      <ScrollFx />
      <SiteHeader />

      <main>
        {/* ── hero ─────────────────────────────────────────── */}
        <section className="relative flex min-h-[88svh] flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
          <Petals />
          <span
            aria-hidden
            className="font-display parallax pointer-events-none absolute left-1/2 top-1/2 select-none italic leading-none"
            style={{ fontSize: "min(72vw, 820px)", color: "var(--ink)", opacity: 0.045 }}
          >
            &amp;
          </span>

          <p className="kicker rise rise-1">Indian wedding invitations</p>
          <h1
            className="font-display rise rise-2 mt-6 tracking-tight"
            style={{ fontSize: "clamp(3rem, 11vw, 8.5rem)", lineHeight: 0.92 }}
          >
            Five days.<br />
            <em className="foil italic">One</em> link.
          </h1>

          <div className="rise rise-3 mt-10">
            <Ornament theme="ivory-editorial" slot="hero" anim="load" />
          </div>

          <p className="rise rise-3 mt-8 max-w-xl text-base leading-relaxed md:text-lg" style={{ color: "var(--ink-soft)" }}>
            A wedding site that holds every celebration, asks each guest which ones
            they&apos;re coming to, and counts the answers for you. Built in two minutes,
            shared on WhatsApp.
          </p>

          <div className="rise rise-4 mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/start" className="cta">Create your site — free</Link>
            <Link href="/w/ananya-weds-arjun" className="cta-ghost">See a real one</Link>
          </div>

          <span aria-hidden className="scroll-cue absolute bottom-8" />
        </section>

        {/* ── the live product ─────────────────────────────── */}
        <section id="preview" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="reveal"><LivePreview /></div>
        </section>

        {/* ── how it works ─────────────────────────────────── */}
        <section id="how" className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <div className="reveal mb-14" data-fx="left">
            <p className="kicker">How it works</p>
            <h2 className="font-display mt-4 pb-5 text-4xl tracking-tight md:text-5xl">Three things, in this order.</h2>
            <div className="rule-taper" aria-hidden />
          </div>
          <ol className="grid gap-12 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="reveal" style={{ "--rd": `${i * 0.12}s` } as React.CSSProperties}>
                <span className="font-display text-3xl" style={{ color: "var(--ink-soft)", opacity: 0.5 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display mt-3 text-3xl tracking-tight">{s.title}</h3>
                <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── the guest's half ─────────────────────────────── */}
        <section id="guests" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
            <div className="reveal" data-fx="left">
              <p className="kicker">What your guests get</p>
              <h2 className="font-display mt-4 text-4xl tracking-tight md:text-5xl">
                Half a minute, on a phone, with no password.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                This is the actual form, and it works — answer it. Your guests pick the
                celebrations they can make and say how many are coming. Plans change, so
                the same link edits the answer later.
              </p>
              <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                Every reply lands on your dashboard as it happens: who is coming, who
                hasn&apos;t answered, and the headcount per event for the caterer.
              </p>
            </div>
            <div className="reveal" data-fx="right"><RsvpDemo /></div>
          </div>
        </section>

        {/* ── ceremonies ───────────────────────────────────── */}
        <section id="ceremonies" className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <div className="reveal mb-12" data-fx="left">
            <p className="kicker">Ceremonies</p>
            <h2 className="font-display mt-4 pb-5 text-4xl tracking-tight md:text-5xl">
              Your wedding isn&apos;t one event, so we didn&apos;t build it that way.
            </h2>
            <div className="rule-taper" aria-hidden />
          </div>
          <div className="reveal flex flex-wrap gap-2.5">
            {EVENT_PRESETS.map((p) => <span key={p.name} className="rite">{p.name}</span>)}
            <span className="rite" style={{ borderStyle: "dashed" }}>+ anything of your own</span>
          </div>
          <p className="reveal mt-8 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Tap one and it arrives on your timeline with the right day, a dress code and a
            line of description already written — then you change the venue and it&apos;s
            yours. Hindu, Muslim, Sikh or South Indian, the ones you don&apos;t need simply
            stay off.
          </p>
        </section>

        {/* ── features ─────────────────────────────────────── */}
        <section id="features" className="mx-auto max-w-5xl px-6 py-20 md:py-28">
          <div className="reveal mb-14" data-fx="left">
            <p className="kicker">The rest of it</p>
            <h2 className="font-display mt-4 pb-5 text-4xl tracking-tight md:text-5xl">Built for how Indian weddings actually run.</h2>
            <div className="rule-taper" aria-hidden />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {FEATURES.map(([title, body], i) => (
              <div
                key={title}
                className="reveal card-mount p-8"
                data-fx="scale"
                style={{ "--rd": `${(i % 2) * 0.12}s` } as React.CSSProperties}
              >
                <h3 className="font-display text-2xl md:text-3xl">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── closing ──────────────────────────────────────── */}
        <div className="scallop" aria-hidden />
        <section className="px-6 py-24 text-center md:py-32" style={{ background: "var(--band-bg)", color: "var(--band-ink)" }}>
          <p className="kicker reveal foil">Free while we&apos;re in pilot</p>
          <h2 className="font-display reveal mx-auto mt-6 max-w-3xl text-4xl tracking-tight md:text-6xl">
            Start with the names. The rest can wait.
          </h2>
          <p className="reveal mx-auto mt-6 max-w-md text-sm leading-relaxed opacity-75">
            No card, no app, no sales call. You&apos;ll have a link to send before anyone
            asks you for one.
          </p>
          <Link
            href="/start"
            className="reveal mt-10 inline-block px-10 py-4 text-xs uppercase tracking-[0.2em]"
            style={{ background: "var(--band-ink)", color: "var(--band-bg)" }}
          >
            Create your site
          </Link>
        </section>
      </main>

      <footer className="px-6 py-12 text-center">
        <p className="font-display text-2xl tracking-tight">
          {BRAND}<span aria-hidden className="foil italic"> &amp;</span>
        </p>
        <p className="kicker mt-3">{BRAND_TAGLINE}</p>
        <nav aria-label="Footer" className="mt-6 flex flex-wrap items-center justify-center gap-6">
          <Link href="/start" className="nav-link">Create a site</Link>
          <Link href="/signin" className="nav-link">Sign in</Link>
          <Link href="/w/ananya-weds-arjun" className="nav-link">Example wedding</Link>
        </nav>
      </footer>
    </div>
  );
}
