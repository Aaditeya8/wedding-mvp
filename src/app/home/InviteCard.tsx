"use client";

import { useEffect, useRef, useState } from "react";
import { Ornament } from "@/themes/ornaments";

/* An Indian wedding invitation is a physical object before it is anything
   else — card stock, a gold rule, a seal you break. This is that object:
   a cover on a real hinge over a real page, tilting to the pointer like
   something held. Click it and it opens.

   CSS 3D rather than a WebGL canvas: this is one hinged plane and a tilt,
   which transforms do natively at compositor speed, with text that stays
   selectable and readable by a screen reader. */

const RITES = ["Mehendi", "Sangeet", "Pheras", "Reception"];

export function InviteCard() {
  const [open, setOpen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  // Pointer tilt. Fine pointers only — on a touch screen there is no hover to
  // track, and the tilt would fight the scroll.
  useEffect(() => {
    const el = stage.current;
    const c = card.current;
    if (!el || !c) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      c.style.setProperty("--tx", `${x * 16}deg`);
      c.style.setProperty("--ty", `${-y * 12}deg`);
    };
    const reset = () => {
      c.style.setProperty("--tx", "0deg");
      c.style.setProperty("--ty", "0deg");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div ref={stage} className="card3d-stage">
        <div ref={card} className="card3d" data-open={open}>
          {/* the page inside */}
          <div className="card3d-inner">
            <p className="kicker" style={{ fontSize: "0.5rem" }}>Together with their families</p>
            <h3 className="font-display mt-3 leading-[0.95] tracking-tight" style={{ fontSize: "2.6rem" }}>
              Ananya<br /><em className="foil italic">&amp;</em> Arjun
            </h3>
            <div className="mt-3 scale-75"><Ornament theme="ivory-editorial" slot="hero" /></div>
            <p className="kicker mt-2" style={{ fontSize: "0.46rem" }}>20 November 2026 · Mumbai</p>
            <ul className="mt-5 flex flex-wrap justify-center gap-1.5">
              {RITES.map((r) => (
                <li key={r} className="rite" style={{ fontSize: "0.6rem", padding: "0.3em 0.7em" }}>{r}</li>
              ))}
            </ul>
            <p className="mt-5 text-[0.62rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Tell us which you can make —<br />it takes half a minute.
            </p>
          </div>

          {/* the cover */}
          <button
            type="button"
            className="card3d-cover flex flex-col items-center justify-center gap-5"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close the invitation" : "Open the invitation"}
          >
            <p className="kicker" style={{ fontSize: "0.5rem" }}>You are invited</p>
            <span className="font-display text-5xl italic" style={{ color: "var(--ink)" }}>
              A <span className="foil">&amp;</span> A
            </span>
            <span className="seal font-display text-xl">&amp;</span>
          </button>
        </div>
      </div>

      <p
        className="card3d-hint mt-6 text-xs"
        style={{ color: "var(--ink-soft)", opacity: open ? 0 : 1 }}
        aria-hidden
      >
        {open ? "" : "Tap the card to open it"}
      </p>
    </div>
  );
}
