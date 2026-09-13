import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicWedding } from "@/lib/open-rsvp";
import { rsvpWindow } from "@/lib/open-rsvp";
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

// The wedding-day city: what the couple typed, else where the Pheras happen
function weddingCity(city: string | null, events: { name: string; address: string | null }[]) {
  if (city) return city;
  const main = events.find((e) => e.name === "Pheras") ?? events[events.length - 1];
  return main?.address?.split(",").pop()?.trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const data = await getPublicWedding((await params).slug);
  if (!data) return { title: "Wedding" };
  const { wedding } = data;
  return {
    title: `${wedding.brideName} weds ${wedding.groomName}`,
    description: wedding.heroTagline ?? `Join us on ${fmtWeddingDate(wedding.weddingDate)}`,
    openGraph: {
      title: `${wedding.brideName} & ${wedding.groomName}`,
      description: `${fmtWeddingDate(wedding.weddingDate)}${wedding.city ? ` · ${wedding.city}` : ""} — you're invited. Tap to see the celebrations and RSVP.`,
      type: "website",
    },
  };
}

export default async function WeddingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const data = await getPublicWedding((await params).slug);
  if (!data) notFound();
  const { wedding, events } = data;
  const window = rsvpWindow(wedding);
  // section numbers count only what this wedding actually shows
  const hasTravel = !!(wedding.travel?.stays?.length || wedding.travel?.gettingThere);
  let n = 0;
  const no = () => String(++n).padStart(2, "0");
  const storyNo = wedding.story ? no() : "";
  const eventsNo = no();
  const travelNo = hasTravel ? no() : "";
  const galleryNo = no();

  return (
    <main data-theme={wedding.theme} className="themed flex-1">
      {/* arm scroll-fx before below-fold sections paint (no reveal flash);
          ScrollFx then drives the observers after hydration */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('fx')" }} />
      <ScrollFx />
      <Hero wedding={wedding} city={weddingCity(wedding.city, events)} />
      <Marquee items={[...events.map((e) => e.name), fmtWeddingDate(wedding.weddingDate)]} />
      <Story theme={wedding.theme} story={wedding.story} no={storyNo} />
      <EventTimeline theme={wedding.theme} events={events} no={eventsNo} />
      <TravelStay travel={wedding.travel} no={travelNo} />
      <Gallery theme={wedding.theme} no={galleryNo} />
      <RsvpCta slug={wedding.slug} open={window.open} deadline={wedding.rsvpDeadline} contactPhone={wedding.contactPhone} />
      <footer className="hairline-t px-6 py-10 text-center">
        <p className="kicker">
          {wedding.brideName} &amp; {wedding.groomName} · {fmtWeddingDate(wedding.weddingDate)}
          {wedding.hashtag ? ` · #${wedding.hashtag}` : ""}
        </p>
      </footer>
    </main>
  );
}
