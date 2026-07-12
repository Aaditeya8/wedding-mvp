"use client";

import { useState, useTransition } from "react";
import { upsertFamily } from "./actions";

export type FamilyDraft = {
  familyId?: string;
  name: string;
  side: "bride" | "groom" | "both";
  relation: string;
  email: string;
  members: { fullName: string; ageGroup: "adult" | "child" }[];
  eventIds: string[];
};

const EMPTY: FamilyDraft = {
  name: "", side: "bride", relation: "", email: "",
  members: [{ fullName: "", ageGroup: "adult" }], eventIds: [],
};

export function FamilyForm({
  weddingId,
  events,
  draft,
  onClose,
}: {
  weddingId: string;
  events: { id: string; name: string }[];
  draft: FamilyDraft | null;
  onClose: (saved: boolean) => void;
}) {
  const [form, setForm] = useState<FamilyDraft>(draft ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FamilyDraft>(key: K, value: FamilyDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await upsertFamily({
        weddingId,
        familyId: form.familyId,
        name: form.name.trim(),
        side: form.side,
        relation: form.relation.trim() || undefined,
        email: form.email.trim(),
        members: form.members.filter((m) => m.fullName.trim()),
        eventIds: form.eventIds,
      });
      if (res.ok) onClose(true);
      else setError(res.error ?? "failed");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">{form.familyId ? "Edit family" : "Add family"}</h2>

        <div className="mt-5 space-y-4 text-sm">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Family name</span>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Sharma Family"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Side</span>
              <select
                value={form.side}
                onChange={(e) => set("side", e.target.value as FamilyDraft["side"])}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
              >
                <option value="bride">Bride</option>
                <option value="groom">Groom</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Relation</span>
              <input
                value={form.relation}
                onChange={(e) => set("relation", e.target.value)}
                placeholder="Mama's family"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Email (one per household)</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="sharma@example.com"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>

          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500">Members</legend>
            <div className="mt-1 space-y-2">
              {form.members.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={m.fullName}
                    onChange={(e) =>
                      set("members", form.members.map((x, j) => (j === i ? { ...x, fullName: e.target.value } : x)))
                    }
                    placeholder="Full name"
                    className="flex-1 rounded-md border border-neutral-300 px-3 py-2"
                  />
                  <select
                    value={m.ageGroup}
                    onChange={(e) =>
                      set("members", form.members.map((x, j) => (j === i ? { ...x, ageGroup: e.target.value as "adult" | "child" } : x)))
                    }
                    className="rounded-md border border-neutral-300 px-2 py-2"
                  >
                    <option value="adult">Adult</option>
                    <option value="child">Child</option>
                  </select>
                  <button
                    type="button"
                    aria-label="Remove member"
                    onClick={() => set("members", form.members.filter((_, j) => j !== i))}
                    disabled={form.members.length === 1}
                    className="rounded-md border border-neutral-200 px-2 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set("members", [...form.members, { fullName: "", ageGroup: "adult" }])}
                className="text-xs text-neutral-500 underline underline-offset-2"
              >
                + add member
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500">Invited to</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {events.map((e) => {
                const on = form.eventIds.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set("eventIds", on ? form.eventIds.filter((id) => id !== e.id) : [...form.eventIds, e.id])
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      on
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
                    }`}
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => onClose(false)}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending || !form.name.trim() || !form.email.trim() || !form.members.some((m) => m.fullName.trim())}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save family"}
          </button>
        </div>
      </div>
    </div>
  );
}
