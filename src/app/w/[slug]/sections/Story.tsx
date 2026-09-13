import { SectionHeader } from "./SectionHeader";
import { Ornament } from "@/themes/ornaments";

export function Story({ theme, story, no = "01" }: { theme: string; story: string | null; no?: string }) {
  if (!story) return null;
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
      <SectionHeader no={no} title="Our Story" />
      <div className="grid gap-10 md:grid-cols-12">
        <p className="kicker reveal md:col-span-3 md:pt-4" data-fx="left">
          How we met
        </p>
        <blockquote className="story-passage reveal md:col-span-9" data-fx="right">
          <span aria-hidden className="story-quote font-display">&ldquo;</span>
          <p className="story-text font-display">{story}</p>
        </blockquote>
      </div>
      <div className="reveal mt-20">
        <Ornament theme={theme} slot="divider" anim="scroll" />
      </div>
    </section>
  );
}
