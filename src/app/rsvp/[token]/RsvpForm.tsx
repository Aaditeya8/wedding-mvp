"use client";

import { useState, useTransition } from "react";
import { submitRsvpAction } from "../actions";
import { fmtEventDate, fmtEventTime } from "@/lib/format";

type EventProp = {
  id: string;
  name: string;
  startsAtISO: string;
  venueName: string;
  address: string;
  dressCode: string | null;
  rsvp: { status: "attending" | "declined"; headcount: number; note: string | null } | null;
};

type Status = "attending" | "declined" | null;

export function RsvpForm({
  token,
  memberCount,
  events,
}: {
  token: string;
  memberCount: number;
  events: EventProp[];
}) {
  const maxHeads = memberCount + 2;
  const [statuses, setStatuses] = useState<Record<string, Status>>(
    () => Object.fromEntries(events.map((e) => [e.id, e.rsvp?.status ?? null])),
  );
  const [heads, setHeads] = useState<Record<string, number>>(
    () => Object.fromEntries(events.map((e) => [
      e.id,
      e.rsvp && e.rsvp.status === "attending" && e.rsvp.headcount > 0 ? e.rsvp.headcount : memberCount,
    ])),
  );
  const [note, setNote] = useState<string>(() => events.find((e) => e.rsvp?.note)?.rsvp?.note ?? "");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = events.filter((e) => statuses[e.id] !== null);
  const firstAttending = events.find((e) => statuses[e.id] === "attending");

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitRsvpAction({
        token,
        responses: answered.map((e) => ({
          eventId: e.id,
          status: statuses[e.id] as "attending" | "declined",
          headcount: statuses[e.id] === "attending" ? heads[e.id] : 0,
          note: note.trim() ? note.trim() : undefined,
        })),
      });
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="mt-16 text-center">
        <p className="font-display text-4xl tracking-tight md:text-5xl">
          {firstAttending ? `See you at the ${firstAttending.name}!` : "We'll miss you."}
        </p>
        <p className="mt-6 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Your answers are saved. Plans change — you can edit them anytime from
          this same link.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-14">
      <ol className="space-y-6">
        {events.map((e) => {
          const status = statuses[e.id];
          const startsAt = new Date(e.startsAtISO);
          return (
            <li
              key={e.id}
              data-testid="event-card"
              className="p-7 md:p-8"
              style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-3xl tracking-tight">{e.name}</h2>
                <p className="kicker" style={{ letterSpacing: "0.22em" }}>
                  {fmtEventDate(startsAt)} · {fmtEventTime(startsAt)}
                </p>
              </div>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                {e.venueName} — {e.address}
                {e.dressCode ? ` · Dress: ${e.dressCode}` : ""}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  aria-pressed={status === "attending"}
                  onClick={() => setStatuses((s) => ({ ...s, [e.id]: "attending" }))}
                  className="rounded-full px-6 py-2.5 text-sm transition-colors"
                  style={
                    status === "attending"
                      ? { background: "var(--accent)", color: "var(--surface)", border: "1px solid var(--accent)" }
                      : { border: "1px solid var(--hairline)", color: "var(--ink)" }
                  }
                >
                  Attending
                </button>
                <button
                  type="button"
                  aria-pressed={status === "declined"}
                  onClick={() => setStatuses((s) => ({ ...s, [e.id]: "declined" }))}
                  className="rounded-full px-6 py-2.5 text-sm transition-colors"
                  style={
                    status === "declined"
                      ? { background: "var(--ink)", color: "var(--bg)", border: "1px solid var(--ink)" }
                      : { border: "1px solid var(--hairline)", color: "var(--ink)" }
                  }
                >
                  Decline
                </button>

                {status === "attending" && (
                  <div
                    className="ml-auto flex items-center gap-4 rounded-full px-4 py-1.5"
                    style={{ border: "1px solid var(--hairline)" }}
                  >
                    <button
                      type="button"
                      aria-label={`Fewer guests for ${e.name}`}
                      onClick={() => setHeads((h) => ({ ...h, [e.id]: Math.max(1, h[e.id] - 1) }))}
                      className="text-lg leading-none"
                      style={{ color: "var(--accent-2)" }}
                    >
                      −
                    </button>
                    <span className="min-w-10 text-center text-sm">
                      {heads[e.id]} {heads[e.id] === 1 ? "guest" : "guests"}
                    </span>
                    <button
                      type="button"
                      aria-label={`More guests for ${e.name}`}
                      onClick={() => setHeads((h) => ({ ...h, [e.id]: Math.min(maxHeads, h[e.id] + 1) }))}
                      className="text-lg leading-none"
                      style={{ color: "var(--accent-2)" }}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <label className="mt-8 block">
        <span className="kicker">A note for the family (optional)</span>
        <textarea
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Dietary needs, arrival times, wheelchair access…"
          className="mt-3 w-full resize-none p-4 text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
        />
      </label>

      {error && (
        <p className="mt-4 text-sm" role="alert" style={{ color: "var(--accent-2)" }}>
          {error === "too many requests"
            ? "A little too fast — give it a minute and try again."
            : "Something went wrong saving your answers. Please try again."}
        </p>
      )}

      <button
        type="button"
        disabled={answered.length === 0 || pending}
        onClick={submit}
        className="mt-8 w-full px-8 py-4 text-sm tracking-[0.2em] uppercase transition-opacity disabled:opacity-40"
        style={{ background: "var(--accent)", color: "var(--surface)" }}
      >
        {pending ? "Saving…" : "Send RSVP"}
      </button>
      <p className="mt-4 text-center text-xs" style={{ color: "var(--ink-soft)" }}>
        Answer for the events you can — you can come back for the rest.
      </p>
    </div>
  );
}
