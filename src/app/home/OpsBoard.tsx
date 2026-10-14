"use client";

import { useEffect, useRef, useState } from "react";

/* The family's side of the product, as it actually looks: the guest-list
   workspace, with replies landing while you watch. Scripted, not random, so
   the numbers it ends on are the numbers in the copy beside it. It runs once,
   only when on screen. */

type Row = { family: string; side: "Bride" | "Groom"; heads: number; sangeet: number; pheras: number; reception: number; veg: boolean; replied: boolean };

const START: Row[] = [
  { family: "The Mehras", side: "Bride", heads: 4, sangeet: 4, pheras: 4, reception: 4, veg: true, replied: true },
  { family: "Kapoor parivar", side: "Groom", heads: 6, sangeet: 6, pheras: 2, reception: 6, veg: false, replied: true },
  { family: "Dr. Iyer & family", side: "Bride", heads: 3, sangeet: 0, pheras: 3, reception: 3, veg: true, replied: true },
  { family: "Sameer & Tanvi", side: "Groom", heads: 2, sangeet: 2, pheras: 2, reception: 2, veg: false, replied: false },
  { family: "Nani ji's side", side: "Bride", heads: 9, sangeet: 9, pheras: 9, reception: 9, veg: true, replied: false },
  { family: "The Bhatias", side: "Groom", heads: 5, sangeet: 5, pheras: 0, reception: 5, veg: false, replied: false },
  { family: "Ananya's office", side: "Bride", heads: 7, sangeet: 7, pheras: 0, reception: 7, veg: false, replied: false },
  { family: "Chachu & Chachi", side: "Groom", heads: 3, sangeet: 3, pheras: 3, reception: 3, veg: true, replied: false },
];

const ORDER = [4, 3, 6, 7, 5]; // the order replies land, for pacing

export function OpsBoard() {
  const [rows, setRows] = useState<Row[]>(START);
  const [flash, setFlash] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return;
      started.current = true;
      io.disconnect();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      ORDER.forEach((idx, k) => {
        setTimeout(() => {
          setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, replied: true } : r)));
          if (!reduced) {
            setFlash(idx);
            setTimeout(() => setFlash((f) => (f === idx ? null : f)), 900);
          }
        }, reduced ? 0 : 1200 + k * 1500);
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const replied = rows.filter((r) => r.replied);
  const sum = (k: "sangeet" | "pheras" | "reception" | "heads") => replied.reduce((n, r) => n + r[k], 0);
  const veg = replied.filter((r) => r.veg).reduce((n, r) => n + r.heads, 0);
  const pending = rows.length - replied.length;

  return (
    <div ref={ref} className="portal-panel board">
      <div className="board-head">
        <div>
          <p className="portal-eyebrow">Ananya &amp; Arjun · Guest list</p>
          <p className="board-title">{rows.length} families · {pending ? `${pending} still to answer` : "everyone has answered"}</p>
        </div>
        <span className="portal-badge">{pending ? "Replies arriving" : "Up to date"}</span>
      </div>

      <div className="board-stats">
        <Stat label="Sangeet" value={sum("sangeet")} />
        <Stat label="Pheras" value={sum("pheras")} />
        <Stat label="Reception" value={sum("reception")} />
        <Stat label="Veg plates" value={veg} />
      </div>

      <table className="portal-table w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">Family</th>
            <th className="text-left">Side</th>
            <th className="text-right">Sangeet</th>
            <th className="text-right">Pheras</th>
            <th className="text-right">Reception</th>
            <th className="text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.family} data-flash={flash === i}>
              <td className="font-medium">{r.family}</td>
              <td style={{ color: "#74706a" }}>{r.side}</td>
              <td className="text-right tabular-nums">{r.replied ? r.sangeet || "—" : ""}</td>
              <td className="text-right tabular-nums">{r.replied ? r.pheras || "—" : ""}</td>
              <td className="text-right tabular-nums">{r.replied ? r.reception || "—" : ""}</td>
              <td>
                <span className="board-status" data-ok={r.replied}>
                  {r.replied ? `Coming · ${r.heads}` : "Awaiting"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="board-stat">
      <span className="portal-stat-label">{label}</span>
      <span className="board-stat-value tabular-nums">{value}</span>
    </div>
  );
}
