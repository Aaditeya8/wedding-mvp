"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";

const LINKS = [
  { href: "#preview", label: "See it live" },
  { href: "#guests", label: "For guests" },
  { href: "#ceremonies", label: "Ceremonies" },
];

export function SiteHeader() {
  const [stuck, setStuck] = useState(false);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // The progress line is written straight to a CSS variable rather than
    // through React state: this runs on every scroll frame, and re-rendering
    // the header that often would be the most expensive thing on the page.
    const onScroll = () => {
      setStuck(window.scrollY > 24);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      bar.current?.style.setProperty("--p", String(p));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <header className="nav" data-stuck={stuck}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="font-display text-xl tracking-tight" style={{ color: "var(--ink)" }}>
          {BRAND}
          <span aria-hidden className="foil italic"> &amp;</span>
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/signin" className="nav-link hidden sm:inline">Sign in</Link>
          <Link href="/start" className="cta">Create your site</Link>
        </div>
      </div>
      <span ref={bar} className="scroll-progress w-full" aria-hidden />
    </header>
  );
}
