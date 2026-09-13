import type { Metadata } from "next";
import Link from "next/link";
import { StartForm } from "./StartForm";
import { Ornament } from "@/themes/ornaments";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Create your wedding site",
  description: "A themed wedding invitation site with per-event RSVP, live in two minutes.",
};

export default async function StartPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const { theme } = await searchParams;
  return (
    <main data-theme="ivory-editorial" className="themed min-h-svh px-6 py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <Link href="/" className="kicker rise rise-1 inline-block underline-offset-4 hover:underline">{BRAND}</Link>
          <h1 className="font-display rise rise-2 mt-6 tracking-tight" style={{ fontSize: "clamp(2.6rem, 8vw, 4.5rem)", lineHeight: 1.02 }}>
            Your wedding site,<br />live in two minutes.
          </h1>
          <p className="rise rise-3 mt-6 text-base md:text-lg" style={{ color: "var(--ink-soft)" }}>
            Names, date, city — we build the invitation, the celebrations schedule and the RSVP.
            You share one link on WhatsApp. Everything else is editable afterwards.
          </p>
          <div className="rise rise-3 mt-8">
            <Ornament theme="ivory-editorial" slot="hero" />
          </div>
        </header>
        <StartForm initialTheme={theme} />
        <p className="mt-10 text-center text-xs" style={{ color: "var(--ink-soft)" }}>
          Already have a site? <Link href="/signin" className="underline underline-offset-4">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
