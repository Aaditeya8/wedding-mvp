"use client";

import { useEffect, useMemo, useState } from "react";
import type { Analysis } from "./actions";
import { buildQuestions, type Answers, type EventRef, type Mapping, type Question } from "@/lib/import/mapping";
import { buildRows } from "@/lib/import/normalize";
import { TARGET_FIELDS, type TargetField } from "@/lib/import/targets";

const KIND_LABEL: Record<string, string> = {
  email: "emails", phone: "phone numbers", number: "numbers", boolean: "yes / no", text: "text", empty: "empty",
};

function confidenceLabel(c: number | undefined): { text: string; cls: string } | null {
  if (c === undefined) return null;
  if (c >= 0.85) return { text: "confident", cls: "border-green-200 bg-green-50 text-green-700" };
  if (c >= 0.6) return { text: "probably", cls: "border-amber-200 bg-amber-50 text-amber-700" };
  return { text: "a guess", cls: "border-neutral-200 bg-neutral-50 text-neutral-500" };
}

export function MappingStep({
  analysis,
  events,
  mapping,
  setMapping,
  answers,
  setAnswers,
  pending,
  onSheetChange,
  onBack,
  onPreview,
}: {
  analysis: Analysis;
  events: EventRef[];
  mapping: Mapping;
  setMapping: (m: Mapping) => void;
  answers: Answers;
  setAnswers: (a: Answers) => void;
  pending: boolean;
  onSheetChange: (index: number) => void;
  onBack: () => void;
  onPreview: () => void;
}) {
  const { sheet, profiles, proposal } = analysis;
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // The questions follow the mapping live: flip "one person per row" and the
  // grouping question appears; map an events column and the default-events one goes.
  const questions = useMemo(() => {
    const missing = buildRows(sheet, mapping, {}, events).rows.filter((r) => r.issues.includes("missing_email")).length;
    return buildQuestions(mapping, profiles, events, missing);
  }, [sheet, mapping, profiles, events]);

  useEffect(() => {
    const filled: Answers = { ...answers };
    let changed = false;
    for (const q of questions) {
      if (q.id === "granularity") continue;
      if (filled[q.id] === undefined) { filled[q.id] = q.default; changed = true; }
    }
    if (changed) setAnswers(filled);
  }, [questions, answers, setAnswers]);

  function assignField(field: TargetField, value: string) {
    const index = value === "" ? null : Number(value);
    const fields = { ...mapping.fields, [field]: index };
    const eventColumns = { ...mapping.eventColumns };
    if (index !== null) {
      for (const f of TARGET_FIELDS) if (f.id !== field && fields[f.id] === index) fields[f.id] = null;
      for (const id of Object.keys(eventColumns)) if (eventColumns[id] === index) eventColumns[id] = null;
    }
    const confidence = { ...mapping.confidence };
    delete confidence[field];
    setTouched(new Set(touched).add(field));
    setMapping({ ...mapping, fields, eventColumns, confidence });
  }

  function assignEvent(eventId: string, value: string) {
    const index = value === "" ? null : Number(value);
    const fields = { ...mapping.fields };
    const eventColumns = { ...mapping.eventColumns, [eventId]: index };
    if (index !== null) {
      for (const f of TARGET_FIELDS) if (fields[f.id] === index) fields[f.id] = null;
      for (const id of Object.keys(eventColumns)) if (id !== eventId && eventColumns[id] === index) eventColumns[id] = null;
    }
    setTouched(new Set(touched).add(`event:${eventId}`));
    setMapping({ ...mapping, fields, eventColumns });
  }

  function answer(q: Question, value: string) {
    if (q.id === "granularity") { setMapping({ ...mapping, granularity: value as Mapping["granularity"] }); return; }
    setAnswers({ ...answers, [q.id]: value });
  }

  const assignment = new Map<number, string>();
  for (const f of TARGET_FIELDS) { const i = mapping.fields[f.id]; if (i !== null) assignment.set(i, f.label); }
  for (const [id, i] of Object.entries(mapping.eventColumns)) { if (i !== null) assignment.set(i, `${events.find((e) => e.id === id)?.name ?? "event"} · yes/no`); }

  const columnOptions = (
    <>
      <option value="">— not in this sheet —</option>
      {profiles.map((p) => (
        <option key={p.index} value={p.index}>{p.header} · {KIND_LABEL[p.kind]}</option>
      ))}
    </>
  );

  const engineBadge = proposal.engine === "ai"
    ? { text: "Matched by AI", cls: "border-violet-200 bg-violet-50 text-violet-700" }
    : { text: analysis.aiConfigured ? "AI unavailable · matched by column names" : "Matched by column names", cls: "border-neutral-200 bg-neutral-50 text-neutral-600" };

  return (
    <div className="space-y-4">
      <div className="portal-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-neutral-600">
          Read <span className="font-medium text-stone-800">{analysis.fileName}</span>
          {" · "}{sheet.rows.length} rows · {sheet.headers.length} columns
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {analysis.sheets.length > 1 && (
            <label className="text-xs text-neutral-500">
              Sheet{" "}
              <select
                value={analysis.sheetIndex}
                onChange={(e) => onSheetChange(Number(e.target.value))}
                disabled={pending}
                className="portal-input ml-1 inline-block w-auto py-1"
              >
                {analysis.sheets.map((s, i) => <option key={i} value={i}>{s.name} ({s.rowCount})</option>)}
              </select>
            </label>
          )}
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${engineBadge.cls}`}>{engineBadge.text}</span>
        </div>
      </div>

      {proposal.notes.length > 0 && (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-sm text-violet-950">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700">What the AI noticed</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {proposal.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="portal-panel p-5 lg:col-span-3">
          <p className="portal-eyebrow">What each column means</p>
          <p className="mt-1 text-sm text-neutral-500">Correct anything that&apos;s off. A column can only mean one thing.</p>
          <div className="mt-4 space-y-3">
            {TARGET_FIELDS.map((f) => {
              const value = mapping.fields[f.id];
              const conf = touched.has(f.id) ? { text: "you chose", cls: "border-stone-300 bg-stone-100 text-stone-700" } : confidenceLabel(mapping.confidence[f.id]);
              return (
                <div key={f.id} className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                  <div>
                    <p className="text-sm font-medium text-stone-800">{f.label}</p>
                    <p className="text-xs text-neutral-500">{f.hint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={f.label}
                      value={value === null ? "" : String(value)}
                      onChange={(e) => assignField(f.id, e.target.value)}
                      className="portal-input"
                    >
                      {columnOptions}
                    </select>
                    {value !== null && conf && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${conf.cls}`}>{conf.text}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="portal-eyebrow mt-7">Per-event yes/no columns</p>
          <p className="mt-1 text-sm text-neutral-500">If the sheet has a column per function (Haldi: Y/N …), point each event at its column.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {events.map((e) => (
              <label key={e.id} className="text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{e.name}</span>
                <select
                  aria-label={`${e.name} column`}
                  value={mapping.eventColumns[e.id] == null ? "" : String(mapping.eventColumns[e.id])}
                  onChange={(ev) => assignEvent(e.id, ev.target.value)}
                  className="portal-input mt-1"
                >
                  {columnOptions}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div className="portal-panel p-5 lg:col-span-2">
          <p className="portal-eyebrow">A few questions</p>
          <p className="mt-1 text-sm text-neutral-500">Things the sheet can&apos;t tell us on its own.</p>
          <div className="mt-4 space-y-5">
            {questions.map((q) => {
              const current = q.id === "granularity" ? mapping.granularity : (answers[q.id] as string | undefined) ?? q.default;
              const chosen = Array.isArray(answers.eventsChosen) ? answers.eventsChosen : [];
              return (
                <fieldset key={q.id}>
                  <legend className="text-sm font-medium text-stone-800">{q.text}</legend>
                  <div className="mt-2 space-y-1.5">
                    {q.options.map((o) => (
                      <label key={o.value} className="flex cursor-pointer items-start gap-2 text-sm text-neutral-700">
                        <input
                          type="radio"
                          name={q.id}
                          value={o.value}
                          checked={current === o.value}
                          onChange={() => answer(q, o.value)}
                          className="mt-1"
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                    {q.id === "events" && current === "choose" && q.choices && (
                      <div className="ml-6 mt-2 flex flex-wrap gap-2">
                        {q.choices.map((c) => {
                          const on = chosen.includes(c.value);
                          return (
                            <button
                              key={c.value}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setAnswers({ ...answers, eventsChosen: on ? chosen.filter((v) => v !== c.value) : [...chosen, c.value] })}
                              className={`rounded-full border px-3 py-1 text-xs ${on ? "border-stone-800 bg-stone-800 text-white" : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500"}`}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </div>
      </div>

      <div className="portal-panel overflow-x-auto">
        <p className="px-4 pt-4 text-xs font-medium uppercase tracking-wide text-neutral-500">First rows, as we read them</p>
        <table className="portal-table mt-2 w-full text-left text-xs">
          <thead>
            <tr>
              {sheet.headers.map((h, i) => (
                <th key={i} className="p-3 align-top">
                  <span className="block font-medium text-stone-800">{h}</span>
                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${assignment.has(i) ? "bg-stone-800 text-white" : "bg-neutral-100 text-neutral-400"}`}>
                    {assignment.get(i) ?? "ignored"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.slice(0, 5).map((r, ri) => (
              <tr key={ri}>{r.map((c, ci) => <td key={ci} className="max-w-[14rem] truncate">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="portal-button-secondary">← Back</button>
        <button type="button" onClick={onPreview} disabled={pending} className="portal-button disabled:opacity-40">
          {pending ? "Building households…" : "Preview households →"}
        </button>
      </div>
    </div>
  );
}
