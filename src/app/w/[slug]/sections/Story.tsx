import { SectionHeader } from "./SectionHeader";
import { Ornament } from "@/themes/ornaments";

export function Story({ theme, story }: { theme: string; story: string | null }) {
  if (!story) return null;
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
      <SectionHeader no="01" title="Our Story" />
      <div className="reveal grid gap-10 md:grid-cols-12">
        <p className="kicker md:col-span-3 md:pt-3">How it began</p>
        <p
          className="md:col-span-9 max-w-prose text-lg leading-relaxed md:text-xl md:leading-relaxed
            first-letter:font-display first-letter:float-left first-letter:mr-3 first-letter:mt-1
            first-letter:text-[3.4em] first-letter:leading-[0.8]"
          style={{ color: "var(--ink)" }}
        >
          {story}
        </p>
      </div>
      <div className="reveal mt-20">
        <Ornament theme={theme} slot="divider" />
      </div>
    </section>
  );
}
