"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES, THEME_META, type Theme } from "@/themes/catalog";
import { Ornament } from "@/themes/ornaments";
import { Mark } from "@/themes/mark";

/* Six weddings on a slowly turning ring, each card dressed in one of the six
   looks and reading its own tokens, so what turns past you is the product
   itself. Tap a card and the ring brings it to the front; tap it again and
   the cover swings open on its hinge.

   The ring's rotation is written to the DOM every frame from one rAF loop.
   React only hears about two things: which card is in front, and which is
   open.

   Every card stays on show: the three facing away turn their back plate to
   you and dim, they never vanish (their faces are hidden, so no mirrored
   page shows through the plate). An open card lifts out of the ring. It
   closes on a tap anywhere on its page, on Escape, or on a tap on the empty
   stage. */

type Couple = { names: [string, string]; when: string; city: string; rites: string[] };

const WEDDINGS: Record<Theme, Couple> = {
  "ivory-editorial": { names: ["Ananya", "Arjun"], when: "20 November 2026", city: "Mumbai", rites: ["Mehendi", "Sangeet", "Pheras", "Reception"] },
  "raj-mahal": { names: ["Meera", "Dev"], when: "6 December 2026", city: "Udaipur", rites: ["Haldi", "Sangeet", "Baraat", "Pheras"] },
  "gulaab-rococo": { names: ["Riya", "Sahil"], when: "14 February 2027", city: "Goa", rites: ["Engagement", "Mehendi", "Pheras", "Reception"] },
  "mehfil-noor": { names: ["Zara", "Imran"], when: "12 December 2026", city: "Lucknow", rites: ["Mehendi", "Sangeet", "Nikah", "Walima"] },
  "pichwai-bagh": { names: ["Lakshmi", "Karthik"], when: "22 January 2027", city: "Chennai", rites: ["Haldi", "Muhurtham", "Reception"] },
  "neel-chhapa": { names: ["Noor", "Kabir"], when: "28 November 2026", city: "Jaipur", rites: ["Roka", "Sangeet", "Anand Karaj", "Reception"] },
};

const N = THEMES.length;
const STEP = 360 / N;

export function CardRing() {
  const stage = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const rot = useRef(0);
  const target = useRef<number | null>(null);
  const hover = useRef(false);
  const openRef = useRef<number | null>(null);
  const [front, setFront] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  openRef.current = open;

  useEffect(() => {
    const el = ring.current;
    const st = stage.current;
    const tl = tilt.current;
    if (!el || !st || !tl) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const items = Array.from(el.children) as HTMLElement[];

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.05 });
    io.observe(st);

    let raf = 0;
    let last = performance.now();
    let frontNow = -1;

    const paint = () => {
      el.style.transform = `rotateY(${rot.current}deg)`;
      let best = 0;
      let bestC = -2;
      items.forEach((it, i) => {
        const a = (((rot.current + i * STEP) % 360) + 360) % 360;
        const c = Math.cos((a * Math.PI) / 180); // 1 = facing you, -1 = facing away
        // Depth cues as variables, never `opacity` on the item: opacity is a
        // grouping property and flattens the item's 3D, so its back plate
        // (rotated 180deg) could never face you and the rear of the ring was
        // empty. --dim fades the plate of a card seen from behind; --shade is
        // a scrim over the face of a card to the side. A face is never made
        // transparent, or the plates behind would show through it.
        it.style.setProperty("--dim", String(Math.min(1, 0.42 + 0.58 * ((c + 1) / 1.8) ** 1.4)));
        it.style.setProperty("--shade", String(Math.max(0, 0.3 * (1 - c))));
        // only a card turned well away is out of reach; the front card and the
        // ones on either side all take the pointer
        it.style.pointerEvents = c < -0.2 ? "none" : "";
        // facing away: show only the back plate, never a mirrored page
        it.dataset.back = c < 0 ? "true" : "false";
        if (c > bestC) { bestC = c; best = i; }
      });
      items.forEach((it, i) => { it.dataset.front = i === best ? "true" : "false"; });
      if (best !== frontNow) { frontNow = best; setFront(best); }
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (visible) {
        if (target.current !== null) {
          let d = target.current - rot.current;
          d = ((d + 540) % 360) - 180;
          if (reduced || Math.abs(d) < 0.05) { rot.current = target.current; target.current = null; }
          else rot.current += d * Math.min(1, dt / 260);
          paint();
        } else if (!reduced && !hover.current && openRef.current === null) {
          rot.current = (rot.current - dt * 0.009) % 360;
          paint();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    paint();
    raf = requestAnimationFrame(tick);

    const onEnter = () => { hover.current = true; };
    const onLeave = () => {
      hover.current = false;
      tl.style.setProperty("--tx", "0deg");
      tl.style.setProperty("--ty", "0deg");
    };
    const onMove = (e: PointerEvent) => {
      if (!fine || reduced) return;
      const r = st.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tl.style.setProperty("--tx", `${x * 10}deg`);
      tl.style.setProperty("--ty", `${-y * 8}deg`);
    };
    st.addEventListener("pointerenter", onEnter);
    st.addEventListener("pointerleave", onLeave);
    st.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      st.removeEventListener("pointerenter", onEnter);
      st.removeEventListener("pointerleave", onLeave);
      st.removeEventListener("pointermove", onMove);
    };
  }, []);

  // Escape closes whatever is open
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function pick(i: number) {
    if (i === front) {
      // the ring pauses wherever the pointer caught it, so an opening card
      // also eases to dead centre rather than opening at a slant
      if (open !== i) target.current = -i * STEP;
      setOpen((o) => (o === i ? null : i));
    } else {
      target.current = -i * STEP;
      setOpen(null);
    }
  }

  // a tap on the empty stage, outside every card, closes the open one
  function onStageClick(e: React.MouseEvent) {
    if (!(e.target as HTMLElement).closest(".card3d")) setOpen(null);
  }

  const t = THEMES[front];
  const w = WEDDINGS[t];

  return (
    <div className="flex flex-col items-center">
      <div ref={stage} className="wheel-stage" onClick={onStageClick}>
        <div ref={tilt} className="wheel-tilt">
          <div ref={ring} className="wheel">
            {THEMES.map((theme, i) => {
              const c = WEDDINGS[theme];
              const isOpen = open === i;
              return (
                <div
                  key={theme}
                  className="wheel-item themed"
                  data-theme={theme}
                  style={{ "--a": `${i * STEP}deg` } as React.CSSProperties}
                >
                  <div className="card3d" data-open={isOpen}>
                    {/* the whole open page is the close target */}
                    <div className="card3d-inner" onClick={() => setOpen(null)}>
                      <p className="text-[0.5rem] tracking-[0.3em] uppercase" style={{ color: "var(--ink-soft)" }}>Together with their families</p>
                      <h3 className="wheel-names font-display mt-2 leading-[0.95] tracking-tight">
                        {c.names[0]}<br />
                        <em className="foil weds">weds</em><br />
                        {c.names[1]}
                      </h3>
                      <div className="wheel-orn mt-2 scale-[0.6]"><Ornament theme={theme} slot="hero" /></div>
                      <p className="text-[0.5rem] tracking-[0.2em] uppercase" style={{ color: "var(--ink-soft)" }}>{c.when} · {c.city}</p>
                      <ul className="mt-3 flex flex-wrap justify-center gap-1">
                        {c.rites.map((r) => (
                          <li key={r} className="rite" style={{ fontSize: "0.55rem", padding: "0.25em 0.6em" }}>{r}</li>
                        ))}
                      </ul>
                      <button type="button" onClick={() => setOpen(null)} className="wheel-close">
                        Close
                      </button>
                    </div>
                    <button
                      type="button"
                      className="card3d-cover flex flex-col items-center justify-center gap-4"
                      onClick={() => pick(i)}
                      aria-expanded={isOpen}
                      aria-label={
                        i === front
                          ? `${isOpen ? "Close" : "Open"} the invitation of ${c.names[0]} and ${c.names[1]}`
                          : `Bring the ${THEME_META[theme].label} invitation to the front`
                      }
                    >
                      <span className="text-[0.5rem] tracking-[0.3em] uppercase" style={{ color: "var(--ink-soft)" }}>You are invited</span>
                      <Mark size={56} style={{ color: "var(--accent)" }} />
                      <span className="font-display px-3 text-center leading-tight" style={{ color: "var(--ink)", fontSize: "1.35rem" }}>
                        {c.names[0]} <em className="weds">weds</em> {c.names[1]}
                      </span>
                      <span className="seal"><Mark size={26} /></span>
                      <span aria-hidden className="card3d-shade" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="wheel-caption" aria-live="polite">
        <b>{THEME_META[t].label}</b> · {w.names[0]} weds {w.names[1]}, {w.city}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
        {open === null ? "Tap a card to bring it forward, then tap it to open." : "Tap the card again to close it, and the ring turns on."}
      </p>
    </div>
  );
}
