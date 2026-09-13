"use client";

import { useState } from "react";
import type { EventRef } from "@/lib/import/mapping";
import { parseMembersCell, type BuildStats, type ImportRow, type IssueCode, type Member } from "@/lib/import/normalize";
import { EMAIL_RE } from "@/lib/import/profile";
import type { MatchReason } from "@/lib/import/match";

export type OnExisting = "skip" | "update" | "merge";
export type ScanInfo = { engine: "heuristic" | "ai" | "vision"; notes: string[]; textPreview: string | null };

const REASON_LABEL: Record<MatchReason, string> = { email: "same email", name: "same name", members: "same people" };

export function blankRow(n: number, eventIds: string[] = []): ImportRow {
  return { key: `new${n}-${Date.now()}`, name: "", side: "both", relation: "", email: "", members: [], eventIds, issues: [], sourceRows: [] };
}

const ISSUE_LABEL: Record<IssueCode, { text: string; cls: string }> = {
  missing_name: { text: "needs a name", cls: "border-red-200 bg-red-50 text-red-700" },
  invalid_email: { text: "email looks wrong", cls: "border-red-200 bg-red-50 text-red-700" },
  missing_email: { text: "no email", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  unknown_side: { text: "side unclear", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  no_members: { text: "no members listed", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  no_events: { text: "no events", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  duplicate_in_sheet: { text: "same email as another row", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  exists: { text: "already in system", cls: "border-sky-200 bg-sky-50 text-sky-700" },
};

/** Flags that only the server can know stay; the rest are recomputed as the user edits. */
const SERVER_ONLY: IssueCode[] = ["exists", "duplicate_in_sheet", "unknown_side"];

export function liveIssues(row: ImportRow): IssueCode[] {
  const out: IssueCode[] = row.issues.filter((i) => SERVER_ONLY.includes(i));
  if (!row.name.trim()) out.push("missing_name");
  const email = row.email.trim();
  if (!email) out.push("missing_email");
  else if (!EMAIL_RE.test(email)) out.push("invalid_email");
  if (!row.members.some((m) => m.fullName.trim())) out.push("no_members");
  if (!row.eventIds.length) out.push("no_events");
  return out;
}

function membersToText(members: Member[]): string {
  return members.map((m) => (m.ageGroup === "child" ? `${m.fullName} (child)` : m.fullName)).join(", ");
}

function MembersInput({ members, onChange }: { members: Member[]; onChange: (m: Member[]) => void }) {
  const [text, setText] = useState(() => membersToText(members));
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(parseMembersCell(text))}
      placeholder="Rajesh Sharma, Sunita Sharma, Aarav (child)"
      className="portal-input min-w-[16rem]"
      aria-label="Members"
    />
  );
}

export function ReviewGrid({
  mode,
  rows,
  setRows,
  events,
  stats,
  existsCount,
  onExisting,
  setOnExisting,
  scanInfo,
  flash,
  pending,
  onBack,
  onCommit,
}: {
  mode: "upload" | "direct" | "scan";
  rows: ImportRow[];
  setRows: (r: ImportRow[]) => void;
  events: EventRef[];
  stats: BuildStats | null;
  existsCount: number;
  onExisting: OnExisting;
  setOnExisting: (v: OnExisting) => void;
  scanInfo?: ScanInfo | null;
  flash?: string | null;
  pending: boolean;
  onBack: () => void;
  onCommit: () => void;
}) {
  const [showText, setShowText] = useState(false);
  const [counter, setCounter] = useState(rows.length + 1);

  function update(key: string, patch: Partial<ImportRow>) {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function remove(key: string) {
    setRows(rows.filter((r) => r.key !== key));
  }
  function add() {
    setRows([...rows, blankRow(counter, events.map((e) => e.id))]);
    setCounter(counter + 1);
  }

  const live = rows.filter((r) => r.name.trim() || r.email.trim() || r.members.some((m) => m.fullName.trim()));
  const flagged = live.filter((r) => liveIssues(r).length).length;
  const blockers = live.filter((r) => liveIssues(r).some((i) => i === "missing_name" || i === "invalid_email")).length;

  return (
    <div className="space-y-4">
      <div className="portal-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-neutral-600">
          {mode === "upload" && stats ? (
            <>
              <span className="font-medium text-stone-800">{live.length} household{live.length === 1 ? "" : "s"}</span>
              {" "}from {stats.sourceRows} rows
            </>
          ) : (
            <span className="font-medium text-stone-800">{live.length} household{live.length === 1 ? "" : "s"}</span>
          )}
          {flagged > 0 && <span className="ml-2 text-amber-700">· {flagged} with something to check</span>}
          {blockers > 0 && <span className="ml-2 text-red-700">· {blockers} must be fixed first</span>}
        </div>
        <button type="button" onClick={add} className="portal-button-secondary">+ Add household</button>
      </div>

      {scanInfo && (
        <div className={`rounded-2xl border p-4 text-sm ${scanInfo.engine === "heuristic" ? "border-neutral-200 bg-white text-neutral-700" : "border-violet-100 bg-violet-50/60 text-violet-950"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide">
              {scanInfo.engine === "vision" ? "Read from the photo by AI" : scanInfo.engine === "ai" ? "Read by AI" : "Read by the built-in rules"}
            </p>
            {scanInfo.textPreview && (
              <button type="button" onClick={() => setShowText(!showText)} className="portal-link text-xs">{showText ? "hide the text we read" : "show the text we read"}</button>
            )}
          </div>
          {scanInfo.notes.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">{scanInfo.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          )}
          {showText && scanInfo.textPreview && (
            <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-white/70 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{scanInfo.textPreview}</pre>
          )}
        </div>
      )}

      {flash && <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">{flash}</p>}

      {existsCount > 0 && (
        <fieldset className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-sm text-sky-950">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-sky-700">Already on the list</legend>
          <p>{existsCount} household{existsCount === 1 ? " looks" : "s look"} like {existsCount === 1 ? "one that's" : "ones that are"} already on this wedding&apos;s list (same email, same name, or the same people).</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
            {([
              ["merge", "Add what's new to them", "new people, extra events, a missing email — nothing removed"],
              ["skip", "Skip them", "keep exactly what's there"],
              ["update", "Replace them", "this version wins: members and events are overwritten"],
            ] as const).map(([v, label, hint]) => (
              <label key={v} className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="onExisting" value={v} checked={onExisting === v} onChange={() => setOnExisting(v)} className="mt-1" />
                <span><span className="font-medium">{label}</span><br /><span className="text-xs text-sky-800/80">{hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="portal-panel overflow-x-auto">
        <table className="portal-table w-full min-w-[84rem] text-left text-sm">
          <thead>
            <tr>
              <th className="p-3">Household</th>
              <th className="p-3">Side</th>
              <th className="p-3">Relation</th>
              <th className="p-3">Email</th>
              <th className="p-3">Members</th>
              <th className="p-3">Invited to</th>
              <th className="p-3">Check</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const issues = liveIssues(r);
              return (
                <tr key={r.key} data-testid="review-row">
                  <td>
                    <input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} placeholder="Sharma Family" className="portal-input min-w-[11rem]" aria-label="Household name" />
                  </td>
                  <td>
                    <select value={r.side} onChange={(e) => update(r.key, { side: e.target.value as ImportRow["side"] })} className="portal-input min-w-[6.5rem]" aria-label="Side">
                      <option value="bride">Bride</option>
                      <option value="groom">Groom</option>
                      <option value="both">Both</option>
                    </select>
                  </td>
                  <td>
                    <input value={r.relation} onChange={(e) => update(r.key, { relation: e.target.value })} placeholder="Mama's family" className="portal-input min-w-[9rem]" aria-label="Relation" />
                  </td>
                  <td>
                    <input type="email" value={r.email} onChange={(e) => update(r.key, { email: e.target.value })} placeholder="sharma@example.com" className="portal-input min-w-[13rem]" aria-label="Email" />
                  </td>
                  <td>
                    <MembersInput key={`${r.key}-${r.members.length}`} members={r.members} onChange={(members) => update(r.key, { members })} />
                  </td>
                  <td className="min-w-[20rem]">
                    <div className="flex flex-wrap gap-1">
                      {events.map((e) => {
                        const on = r.eventIds.includes(e.id);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => update(r.key, { eventIds: on ? r.eventIds.filter((id) => id !== e.id) : [...r.eventIds, e.id] })}
                            className={`rounded-full border px-2 py-0.5 text-xs ${on ? "border-stone-800 bg-stone-800 text-white" : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-500"}`}
                          >
                            {e.name}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="min-w-[10rem]">
                    <div className="flex flex-wrap gap-1">
                      {issues.length === 0 ? (
                        <span className="text-xs text-green-700">✓ ready</span>
                      ) : (
                        issues.map((i) => (
                          <span key={i} className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${ISSUE_LABEL[i].cls}`}>
                            {ISSUE_LABEL[i].text}{i === "exists" && r.match ? ` · ${REASON_LABEL[r.match.reason]}` : ""}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="text-right">
                    <button type="button" onClick={() => remove(r.key)} aria-label={`Remove ${r.name || "row"}`} className="portal-icon-button text-neutral-400 hover:text-neutral-700">×</button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-sm text-neutral-400">No households yet — add one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-neutral-500">
        Nothing is saved until you import. Rows without an email are kept (you can add it later); rows without a name are not.
        {mode !== "upload" && " Households already on the list are checked when you click import."}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="portal-button-secondary">← Back</button>
        <button type="button" onClick={onCommit} disabled={pending || live.length === 0 || blockers > 0} className="portal-button disabled:opacity-40">
          {pending ? "Importing…" : `Import ${live.length} household${live.length === 1 ? "" : "s"} →`}
        </button>
      </div>
    </div>
  );
}
