"use client";

import { useState, useTransition } from "react";
import { submitOpenRsvpAction } from "./actions";
import { fmtEventDate, fmtEventTime } from "@/lib/format";
import { DIET_OPTIONS, MAX_OPEN_HEADCOUNT_UI as MAX } from "./limits";

type EventProp = { id: string; name: string; startsAtISO: string; venueName: string; address: string; dressCode: string | null };
type Status = "attending" | "declined" | null;

const field = { background: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--ink)" } as const;

export function OpenRsvpForm({ slug, events }: { slug: string; events: EventProp[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [side, setSide] = useState<"bride" | "groom" | "both" | "">("");
  const [diet, setDiet] = useState<string>("");
  const [guestNames, setGuestNames] = useState("");
  const [note, setNote] = useState("");
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => Object.fromEntries(events.map((e) => [e.id, null])));
  const [heads, setHeads] = useState<Record<string, number>>(() => Object.fromEntries(events.map((e) => [e.id, 2])));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ editUrl: string; attending: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  const answered = events.filter((e) => statuses[e.id] !== null);
  const canSubmit = name.trim().length >= 2 && (phone.trim() || email.trim()) && answered.length > 0 && !pending;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitOpenRsvpAction({
        slug, name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined,
        side: side || undefined, diet: diet || undefined,
        guestNames: guestNames.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, MAX),
        note: note.trim() || undefined,
        responses: answered.map((e) => ({
          eventId: e.id, status: statuses[e.id] as "attending" | "declined",
          headcount: statuses[e.id] === "attending" ? heads[e.id] : 0,
        })),
      });
      if (res.ok) setDone({ editUrl: res.editPath ? new URL(res.editPath, window.location.origin).toString() : "", attending: res.attending });
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="mt-16 text-center">
        <p className="font-display text-4xl tracking-tight md:text-5xl">
          {done.attending.length ? `See you at the ${done.attending[0]}!` : "We'll miss you."}
        </p>
        <p className="mt-6 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Your answer is saved{done.attending.length > 1 ? ` for ${done.attending.join(", ")}` : ""}.
          {done.editUrl ? " Plans change — keep this link to edit it:" : ""}
        </p>
        {done.editUrl && (
          <div className="mx-auto mt-5 flex max-w-md items-stretch">
            <input readOnly value={done.editUrl} className="min-w-0 flex-1 px-4 py-3 text-xs outline-none" style={field} onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="px-4 text-xs uppercase tracking-[0.15em]"
              style={{ background: "var(--accent)", color: "var(--surface)" }}
              onClick={async () => { try { await navigator.clipboard.writeText(done.editUrl); setCopied(true); } catch { /* ignore */ } }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-14">
      <div className="p-7 md:p-8" style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}>
        <p className="kicker">Who&apos;s replying</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Your name or family name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="The Mehtas / Priya Nair" className="mt-1.5 w-full px-4 py-3 text-sm outline-none" style={field} />
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Phone (WhatsApp)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={30} placeholder="+91 98765 43210" className="mt-1.5 w-full px-4 py-3 text-sm outline-none" style={field} />
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Email (optional)</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={254} placeholder="you@example.com" className="mt-1.5 w-full px-4 py-3 text-sm outline-none" style={field} />
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>You&apos;re here for</span>
            <select value={side} onChange={(e) => setSide(e.target.value as typeof side)} className="mt-1.5 w-full px-4 py-3 text-sm outline-none" style={field}>
              <option value="">Both families</option>
              <option value="bride">The bride&apos;s side</option>
              <option value="groom">The groom&apos;s side</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Food preference</span>
            <select value={diet} onChange={(e) => setDiet(e.target.value)} className="mt-1.5 w-full px-4 py-3 text-sm outline-none" style={field}>
              <option value="">No preference</option>
              {DIET_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Names of everyone coming (optional, comma-separated)</span>
            <input value={guestNames} onChange={(e) => setGuestNames(e.target.value)} maxLength={600} placeholder="Vikram, Kavita, Aarav" className="mt-1.5 w-full px-4 py-3 text-sm outline-none" style={field} />
          </label>
        </div>
      </div>

      <p className="kicker mt-10">The celebrations</p>
      <ol className="mt-5 space-y-6">
        {events.map((e) => {
          const status = statuses[e.id];
          const startsAt = new Date(e.startsAtISO);
          return (
            <li key={e.id} data-testid="event-card" className="p-7 md:p-8" style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-3xl tracking-tight">{e.name}</h2>
                <p className="kicker" style={{ letterSpacing: "0.22em" }}>{fmtEventDate(startsAt)} · {fmtEventTime(startsAt)}</p>
              </div>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                {e.venueName} — {e.address}{e.dressCode ? ` · Dress: ${e.dressCode}` : ""}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" aria-pressed={status === "attending"} onClick={() => setStatuses((s) => ({ ...s, [e.id]: "attending" }))}
                  className="rounded-full px-6 py-2.5 text-sm transition-colors"
                  style={status === "attending" ? { background: "var(--accent)", color: "var(--surface)", border: "1px solid var(--accent)" } : { border: "1px solid var(--hairline)", color: "var(--ink)" }}>
                  Attending
                </button>
                <button type="button" aria-pressed={status === "declined"} onClick={() => setStatuses((s) => ({ ...s, [e.id]: "declined" }))}
                  className="rounded-full px-6 py-2.5 text-sm transition-colors"
                  style={status === "declined" ? { background: "var(--ink)", color: "var(--bg)", border: "1px solid var(--ink)" } : { border: "1px solid var(--hairline)", color: "var(--ink)" }}>
                  Can&apos;t make it
                </button>
                {status === "attending" && (
                  <div className="ml-auto flex items-center gap-4 rounded-full px-4 py-1.5" style={{ border: "1px solid var(--hairline)" }}>
                    <button type="button" aria-label={`Fewer guests for ${e.name}`} onClick={() => setHeads((h) => ({ ...h, [e.id]: Math.max(1, h[e.id] - 1) }))} className="text-lg leading-none" style={{ color: "var(--accent-2)" }}>−</button>
                    <span className="min-w-10 text-center text-sm">{heads[e.id]} {heads[e.id] === 1 ? "guest" : "guests"}</span>
                    <button type="button" aria-label={`More guests for ${e.name}`} onClick={() => setHeads((h) => ({ ...h, [e.id]: Math.min(MAX, h[e.id] + 1) }))} className="text-lg leading-none" style={{ color: "var(--accent-2)" }}>+</button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <label className="mt-8 block">
        <span className="kicker">A note for the family (optional)</span>
        <textarea value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={500} rows={3}
          placeholder="Arrival times, wheelchair access, a message for the couple…"
          className="mt-3 w-full resize-none p-4 text-sm outline-none" style={field} />
      </label>

      {error && (
        <p className="mt-4 text-sm" role="alert" style={{ color: "var(--accent-2)" }}>
          {error === "too many requests" ? "A little too fast — give it a minute and try again."
            : error === "phone or email required" ? "Leave a phone number or an email so the family can reach you."
            : error === "rsvp closed" ? "RSVPs have just closed — please contact the family directly."
            : "Something went wrong saving your answers. Please try again."}
        </p>
      )}

      <button type="button" disabled={!canSubmit} onClick={submit}
        className="mt-8 w-full px-8 py-4 text-sm uppercase tracking-[0.2em] transition-opacity disabled:opacity-40"
        style={{ background: "var(--accent)", color: "var(--surface)" }}>
        {pending ? "Saving…" : "Send RSVP"}
      </button>
      <p className="mt-4 text-center text-xs" style={{ color: "var(--ink-soft)" }}>
        Answer for the events you can — you&apos;ll get a link to change anything later.
      </p>
    </div>
  );
}
