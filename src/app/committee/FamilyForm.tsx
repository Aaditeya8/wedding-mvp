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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/35 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-labelledby="family-form-title">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[#fcfbf9] p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="portal-eyebrow">Guest household</p>
            <h2 id="family-form-title" className="mt-1 text-xl font-semibold tracking-tight">{form.familyId ? "Edit family" : "Add family"}</h2>
          </div>
          <button type="button" onClick={() => onClose(false)} className="portal-icon-button" aria-label="Close family editor">×</button>
        </div>

        <div className="mt-5 space-y-4 text-sm">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Family name</span>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Sharma Family"
              className="portal-input mt-1"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Side</span>
              <select
                value={form.side}
                onChange={(e) => set("side", e.target.value as FamilyDraft["side"])}
                className="portal-input mt-1"
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
                className="portal-input mt-1"
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
              className="portal-input mt-1"
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
                    className="portal-input flex-1"
                  />
                  <select
                    value={m.ageGroup}
                    onChange={(e) =>
                      set("members", form.members.map((x, j) => (j === i ? { ...x, ageGroup: e.target.value as "adult" | "child" } : x)))
                    }
                    className="portal-input w-auto"
                  >
                    <option value="adult">Adult</option>
                    <option value="child">Child</option>
                  </select>
                  <button
                    type="button"
                    aria-label="Remove member"
                    onClick={() => set("members", form.members.filter((_, j) => j !== i))}
                    disabled={form.members.length === 1}
                    className="portal-icon-button h-auto w-10 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set("members", [...form.members, { fullName: "", ageGroup: "adult" }])}
                className="portal-link"
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
                        ? "border-stone-800 bg-stone-800 text-white"
                        : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500"
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
            className="portal-button-secondary"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending || !form.name.trim() || !form.email.trim() || !form.members.some((m) => m.fullName.trim())}
            className="portal-button disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save family"}
          </button>
        </div>
      </div>
    </div>
  );
}
