"use client";

import { useState } from "react";

/* The other half of the product, and the half a couple never sees: what lands
   on a guest's phone. Real controls, no account, no save — the numbers move so
   a visitor feels how little they are asking of their guests. */

const RITES = ["Mehendi", "Sangeet", "Pheras"] as const;
type Rite = (typeof RITES)[number];
type Answer = "yes" | "no" | null;

export function RsvpDemo() {
  const [answers, setAnswers] = useState<Record<Rite, Answer>>({ Mehendi: null, Sangeet: null, Pheras: null });
  const [heads, setHeads] = useState<Record<Rite, number>>({ Mehendi: 2, Sangeet: 2, Pheras: 2 });
  const [sent, setSent] = useState(false);

  const answered = RITES.filter((r) => answers[r] !== null).length;
  const coming = RITES.filter((r) => answers[r] === "yes");
  const total = coming.reduce((n, r) => Math.max(n, heads[r]), 0);

  if (sent) {
    return (
      <div className="card-mount p-10 text-center">
        <p className="kicker">Sent</p>
        <p className="font-display mt-4 text-3xl tracking-tight md:text-4xl">
          {coming.length ? `See you at the ${coming[0]}!` : "We'll miss you."}
        </p>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          {coming.length
            ? `${total} ${total === 1 ? "seat" : "seats"} held across ${coming.length} ${coming.length === 1 ? "celebration" : "celebrations"}. The family's dashboard just moved.`
            : "Declined for everything — the family sees that instantly, and nobody has to chase you."}
        </p>
        <button
          type="button"
          onClick={() => { setAnswers({ Mehendi: null, Sangeet: null, Pheras: null }); setSent(false); }}
          className="cta-ghost mt-8"
        >
          Try it again
        </button>
      </div>
    );
  }

  return (
    <div className="card-mount p-7 md:p-9">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="kicker">Dear Kapoor family</p>
        <p className="text-xs tabular-nums" style={{ color: "var(--ink-soft)" }}>{answered} of 3 answered</p>
      </div>

      <ul className="mt-6 space-y-5">
        {RITES.map((r) => (
          <li key={r} className="pb-5" style={{ borderBottom: "1px solid var(--hairline)" }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-display text-2xl">{r}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="demo-choice"
                  data-kind="yes"
                  aria-pressed={answers[r] === "yes"}
                  onClick={() => setAnswers((a) => ({ ...a, [r]: "yes" }))}
                >
                  Attending
                </button>
                <button
                  type="button"
                  className="demo-choice"
                  data-kind="no"
                  aria-pressed={answers[r] === "no"}
                  onClick={() => setAnswers((a) => ({ ...a, [r]: "no" }))}
                >
                  Can&apos;t make it
                </button>
              </div>
            </div>

            {answers[r] === "yes" && (
              <div className="mt-3 flex items-center gap-4">
                <span className="text-xs" style={{ color: "var(--ink-soft)" }}>How many of you?</span>
                <div className="flex items-center gap-3 rounded-full px-3 py-1" style={{ border: "1px solid var(--hairline)" }}>
                  <button type="button" aria-label={`Fewer guests for ${r}`} style={{ color: "var(--accent-2)" }}
                    onClick={() => setHeads((h) => ({ ...h, [r]: Math.max(1, h[r] - 1) }))}>−</button>
                  <span className="min-w-6 text-center text-sm tabular-nums">{heads[r]}</span>
                  <button type="button" aria-label={`More guests for ${r}`} style={{ color: "var(--accent-2)" }}
                    onClick={() => setHeads((h) => ({ ...h, [r]: Math.min(9, h[r] + 1) }))}>+</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={answered === 0}
        onClick={() => setSent(true)}
        className="mt-7 w-full px-8 py-4 text-xs uppercase tracking-[0.2em] transition-opacity disabled:opacity-40"
        style={{ background: "var(--accent)", color: "var(--surface)" }}
      >
        Send RSVP
      </button>
      <p className="mt-3 text-center text-xs" style={{ color: "var(--ink-soft)" }}>
        A demo — nothing is saved. Your guests see exactly this.
      </p>
    </div>
  );
}
