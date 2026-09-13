import Link from "next/link";
import { Ornament } from "@/themes/ornaments";
import { THEMES, THEME_META } from "@/themes/catalog";
import { BRAND, BRAND_TAGLINE } from "@/lib/brand";
import { ScrollFx } from "./w/[slug]/sections/ScrollFx";
import { SectionHeader } from "./w/[slug]/sections/SectionHeader";

export const metadata = { title: `${BRAND} — ${BRAND_TAGLINE}` };

const STEPS = [
  { n: "01", title: "Tell us the basics", body: "Names, date, city, a look. Your site exists before you finish your chai — with Haldi, Mehendi, Sangeet, Pheras and Reception already on it." },
  { n: "02", title: "Fill in the venues", body: "Edit any celebration, add a Roka or a Walima, switch a family-only function off the public page. Parents' names, your story, hotels for outstation guests." },
  { n: "03", title: "Share one link", body: "WhatsApp it, print the QR on the card. Guests tap, see every event, and reply per function with a headcount — no app, no account. You watch the numbers move." },
];

const FEATURES = [
  ["Per-event RSVP", "Attending the Sangeet but not the Pheras? Guests answer each celebration separately, with how many are coming and what they eat."],
  ["Events on / off", "Hide the family-only puja from the shared link without deleting it. Turn it back on for the personal invites."],
  ["Six looks, one click", "From quiet ivory to Raj Mahal maroon-and-gold. Change it mid-planning; every page and email follows."],
  ["Bring your list as it is", "Upload the spreadsheet you already have, or a photo of the handwritten one. We read it, ask what's unclear, never duplicate a family."],
  ["A dashboard for the family", "Who's coming, who hasn't replied, per-event totals, one-tap reminders. For you, your planner, and the chachu who runs things."],
  ["Personal links too", "Send each family their own emailed invite with a private RSVP link, alongside the open one for the wider circle."],
];

export default function Home() {
  return (
    <main data-theme="ivory-editorial" className="themed flex-1">
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('fx')" }} />
      <ScrollFx />

      <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
        <span aria-hidden className="font-display parallax pointer-events-none absolute left-1/2 top-1/2 select-none italic leading-none"
          style={{ fontSize: "min(72vw, 820px)", color: "var(--ink)", opacity: 0.045 }}>&amp;</span>
        <p className="kicker rise rise-1">{BRAND}</p>
        <h1 className="font-display rise rise-2 mt-6 tracking-tight" style={{ fontSize: "clamp(3rem, 11vw, 8.5rem)", lineHeight: 0.95 }}>
          Your wedding,<br /><em className="foil italic">one</em> link.
        </h1>
        <div className="rise rise-3 mt-10"><Ornament theme="ivory-editorial" slot="hero" anim="load" /></div>
        <p className="rise rise-3 mt-8 max-w-xl text-base md:text-lg" style={{ color: "var(--ink-soft)" }}>
          A themed invitation site for Indian weddings — every celebration, per-event RSVP,
          hotels for the outstation aunties — built in two minutes and shared on WhatsApp.
        </p>
        <div className="rise rise-4 mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/start" className="px-8 py-4 text-sm uppercase tracking-[0.2em]" style={{ background: "var(--accent)", color: "var(--surface)" }}>
            Create your site — free
          </Link>
          <Link href="/w/ananya-weds-arjun" className="px-8 py-4 text-sm uppercase tracking-[0.2em]" style={{ border: "1px solid var(--hairline)", color: "var(--ink)" }}>
            See a live example
          </Link>
        </div>
        <span aria-hidden className="scroll-cue absolute bottom-8" />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
        <SectionHeader no="01" title="How it works" />
        <ol className="grid gap-10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.n} className="reveal" style={{ "--rd": `${i * 0.12}s` } as React.CSSProperties}>
              <span className="font-display text-3xl" style={{ color: "var(--ink-soft)", opacity: 0.55 }}>{s.n}</span>
              <h3 className="font-display mt-3 text-3xl tracking-tight">{s.title}</h3>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
        <SectionHeader no="02" title="Six looks" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {THEMES.map((t, i) => {
            const m = THEME_META[t];
            return (
              <Link key={t} href={`/start?theme=${t}`} className="reveal plate block p-6 md:p-8" data-fx="scale"
                style={{ background: m.bg, color: m.ink, "--rd": `${(i % 3) * 0.1}s` } as React.CSSProperties}>
                <p className="text-3xl leading-tight tracking-tight md:text-4xl" style={{ fontFamily: `${m.fontVar}, Georgia, serif` }}>Ananya<br /><em>&amp;</em> Arjun</p>
                <p className="mt-4 text-[11px] uppercase tracking-[0.25em] opacity-70">{m.label}</p>
                <p className="mt-1 text-xs opacity-60">{m.tagline}</p>
                <div className="mt-5 flex gap-1.5">{m.dots.map((c) => <span key={c} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: c }} />)}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
        <SectionHeader no="03" title="What's inside" />
        <div className="grid gap-6 md:grid-cols-2">
          {FEATURES.map(([title, body], i) => (
            <div key={title} className="reveal card-mount p-8" data-fx="scale" style={{ "--rd": `${(i % 2) * 0.14}s` } as React.CSSProperties}>
              <h3 className="font-display text-2xl md:text-3xl">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="scallop" aria-hidden />
      <section className="px-6 py-24 text-center md:py-32" style={{ background: "var(--band-bg)", color: "var(--band-ink)" }}>
        <p className="kicker reveal foil">Free during the pilot</p>
        <h2 className="font-display reveal mx-auto mt-6 max-w-3xl text-4xl tracking-tight md:text-6xl">Start with the names. Everything else can wait.</h2>
        <Link href="/start" className="reveal mt-10 inline-block px-10 py-4 text-sm uppercase tracking-[0.2em]" style={{ background: "var(--band-ink)", color: "var(--band-bg)" }}>
          Create your site
        </Link>
        <p className="reveal mt-8 text-xs opacity-70">
          Already have one? <Link href="/signin" className="underline underline-offset-4">Sign in</Link>
        </p>
      </section>
      <footer className="hairline-t px-6 py-10 text-center">
        <p className="kicker">{BRAND} · {BRAND_TAGLINE}</p>
      </footer>
    </main>
  );
}
