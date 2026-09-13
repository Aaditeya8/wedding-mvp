"use client";

import { useEffect, useRef, useState } from "react";

/* Counts only once, and only when it is actually on screen — a number that
   animates where nobody is looking is just work. */
export function CountUp({ to, suffix = "", label, note }: {
  to: number; suffix?: string; label: string; note: string;
}) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(to); return; }

    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done.current) return;
      done.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 900);
        // ease-out so it lands softly instead of stopping dead
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });

    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  return (
    <div ref={ref} className="text-center">
      <p className="font-display tabular-nums leading-none" style={{ fontSize: "clamp(3rem, 7vw, 5rem)" }}>
        {n}{suffix}
      </p>
      <p className="kicker mt-4">{label}</p>
      <p className="mx-auto mt-3 max-w-[16rem] text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {note}
      </p>
    </div>
  );
}
