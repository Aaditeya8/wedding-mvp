"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";

const LINKS = [
  { href: "#preview", label: "See it live" },
  { href: "#guests", label: "For guests" },
  { href: "#ceremonies", label: "Ceremonies" },
];

export function SiteHeader() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
    </header>
  );
}
