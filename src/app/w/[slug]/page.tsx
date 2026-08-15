import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getWeddingBySlug } from "@/lib/wedding";
import { Hero } from "./sections/Hero";
import { Marquee } from "./sections/Marquee";
import { ScrollFx } from "./sections/ScrollFx";
import { Story } from "./sections/Story";
import { EventTimeline } from "./sections/EventTimeline";
import { TravelStay } from "./sections/TravelStay";
import { Gallery } from "./sections/Gallery";
import { RsvpCta } from "./sections/RsvpCta";
import { fmtWeddingDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// The wedding-day city, read from where the Pheras happen (addresses end in the city)
function weddingCity(events: { name: string; address: string | null }[]) {
  const main = events.find((e) => e.name === "Pheras") ?? events[events.length - 1];
  return main?.address?.split(",").pop()?.trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const data = await getWeddingBySlug((await params).slug);
  if (!data) return { title: "Wedding" };
  const { wedding } = data;
  return {
    title: `${wedding.brideName} weds ${wedding.groomName}`,
    description: wedding.heroTagline ?? `Join us on ${fmtWeddingDate(wedding.weddingDate)}`,
  };
}

export default async function WeddingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const data = await getWeddingBySlug((await params).slug);
  if (!data) notFound();
  const { wedding, events } = data;

  return (
    <main data-theme={wedding.theme} className="themed flex-1">
      {/* arm scroll-fx before below-fold sections paint (no reveal flash);
          ScrollFx then drives the observers after hydration */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('fx')" }} />
      <ScrollFx />
      <Hero wedding={wedding} city={weddingCity(events)} />
      <Marquee items={[...events.map((e) => e.name), fmtWeddingDate(wedding.weddingDate)]} />
      <Story theme={wedding.theme} story={wedding.story} />
      <EventTimeline theme={wedding.theme} events={events} />
      <TravelStay slug={wedding.slug} />
      <Gallery theme={wedding.theme} />
      <RsvpCta theme={wedding.theme} />
      <footer className="hairline-t px-6 py-10 text-center">
        <p className="kicker">
          {wedding.brideName} &amp; {wedding.groomName} · {fmtWeddingDate(wedding.weddingDate)}
        </p>
      </footer>
    </main>
  );
}
