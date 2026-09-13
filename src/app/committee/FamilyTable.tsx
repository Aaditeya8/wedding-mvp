"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvitesAction } from "./actions";
import { FamilyForm, type FamilyDraft } from "./FamilyForm";

export type Row = {
  id: string;
  name: string;
  side: "bride" | "groom" | "both";
  relation: string | null;
  email: string;
  phone?: string | null;
  diet?: string | null;
  source?: "committee" | "import" | "guest";
  members: { fullName: string; ageGroup: "adult" | "child" }[];
  eventIds: string[];
  rsvpByEvent: Record<string, { status: "attending" | "declined"; headcount: number; note: string | null }>;
  lastEmail: { type: string; status: string; sentAt: string } | null;
};

const SIDE_BADGE: Record<Row["side"], string> = {
  bride: "bg-rose-50 text-rose-700 border-rose-200",
  groom: "bg-sky-50 text-sky-700 border-sky-200",
  both: "bg-amber-50 text-amber-700 border-amber-200",
};

export function FamilyTable({
  weddingId,
  events,
  rows,
}: {
  weddingId: string;
  events: { id: string; name: string }[];
  rows: Row[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<FamilyDraft | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function send(type: "invite" | "resend" | "remind", familyIds: string[]) {
    setFlash(null);
    startTransition(async () => {
      const res = await sendInvitesAction({ weddingId, familyIds, type });
      if (!res.ok) { setFlash(res.error ?? "failed"); return; }
      const sent = res.results.filter((r) => r.ok).length;
      const skipped = res.results.length - sent;
      setFlash(`${sent} sent${skipped ? `, ${skipped} skipped` : ""}`);
      setSelected(new Set());
      router.refresh();
    });
  }

  const ids = [...selected];

  return (
    <section>
      <div className="portal-panel mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setEditing("new")}
          className="portal-button"
        >
          Add family
        </button>
        <a href={`/committee/import?wedding=${weddingId}`} className="portal-button-secondary">
          Import guest list
        </a>
        <div className="mx-1 hidden h-6 w-px bg-neutral-200 sm:block" />
        <button
          disabled={!ids.length || pending}
          onClick={() => send("invite", ids)}
          className="portal-button-secondary"
        >
          Send invites
        </button>
        <button
          disabled={!ids.length || pending}
          onClick={() => send("resend", ids)}
          className="portal-button-secondary"
        >
          Resend link
        </button>
        <button
          disabled={!ids.length || pending}
          onClick={() => send("remind", ids)}
          className="portal-button-secondary"
        >
          Send reminder
        </button>
        </div>
        <p className="text-xs font-medium text-neutral-500" aria-live="polite">
          {pending ? "Sending…" : flash ?? (ids.length ? `${ids.length} household${ids.length === 1 ? "" : "s"} selected` : "Select households to email")}
        </p>
      </div>

      <div className="portal-panel overflow-x-auto">
        <table className="portal-table w-full min-w-[66rem] text-left text-sm">
          <thead>
            <tr>
              <th className="p-3">
                <input
                  type="checkbox"
                  aria-label="Select all families"
                  checked={selected.size === rows.length && rows.length > 0}
                  onChange={(e) =>
                    setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
                  }
                />
              </th>
              <th className="p-3">Family</th>
              <th className="p-3">Email</th>
              <th className="p-3">Members</th>
              <th className="p-3">RSVP by event</th>
              <th className="p-3">Last email</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.name}`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td>
                  <p className="font-medium">{r.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    <span className={`mr-1 inline-block rounded border px-1.5 py-0.5 font-medium ${SIDE_BADGE[r.side]}`}>
                      {r.side}
                    </span>
                    {r.relation}
                    {r.source === "guest" && <span className="ml-1 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-medium text-violet-700">via link</span>}
                    {r.diet && <span className="ml-1 rounded border border-neutral-200 px-1.5 py-0.5">{r.diet}</span>}
                  </p>
                </td>
                <td className="text-neutral-600">
                  {r.email || (r.phone ? <span className="tabular-nums">{r.phone}</span> : <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">no email</span>)}
                  {r.email && r.phone && <p className="mt-0.5 text-xs tabular-nums text-neutral-400">{r.phone}</p>}
                </td>
                <td className="tabular-nums">{r.members.length}</td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {events.map((e) => {
                      const invited = r.eventIds.includes(e.id);
                      const rsvp = r.rsvpByEvent[e.id];
                      if (!invited) return null;
                      return (
                        <span
                          key={e.id}
                          title={`${e.name}: ${rsvp ? (rsvp.status === "attending" ? `${rsvp.headcount} attending` : "declined") : "no answer yet"}${rsvp?.note ? ` — “${rsvp.note}”` : ""}`}
                          className={`rounded-full border px-2 py-1 text-xs font-medium ${
                            rsvp
                              ? rsvp.status === "attending"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-neutral-300 bg-neutral-100 text-neutral-500"
                              : "border-neutral-200 text-neutral-400"
                          }`}
                        >
                          {e.name} {rsvp ? (rsvp.status === "attending" ? `✓${rsvp.headcount}` : "✗") : "—"}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td>
                  {r.lastEmail ? (
                    r.lastEmail.status === "sent" ? (
                      <span className="portal-badge">
                        {r.lastEmail.type} · sent
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-red-600">
                        failed
                        <button
                          disabled={pending}
                          onClick={() => send("resend", [r.id])}
                          className="ml-2 rounded border border-red-200 px-1.5 py-0.5 text-xs hover:bg-red-50"
                        >
                          retry
                        </button>
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-neutral-400">never</span>
                  )}
                </td>
                <td className="text-right">
                  <button
                    onClick={() =>
                      setEditing({
                        familyId: r.id,
                        name: r.name,
                        side: r.side,
                        relation: r.relation ?? "",
                        email: r.email,
                        members: r.members,
                        eventIds: r.eventIds,
                      })
                    }
                    className="portal-link"
                  >
                    edit
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-sm text-neutral-400">
                  No families yet — add the first one, or{" "}
                  <a href={`/committee/import?wedding=${weddingId}`} className="portal-link">import a spreadsheet</a>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <FamilyForm
          weddingId={weddingId}
          events={events}
          draft={editing === "new" ? null : editing}
          onClose={(saved) => {
            setEditing(null);
            if (saved) router.refresh();
          }}
        />
      )}
    </section>
  );
}
