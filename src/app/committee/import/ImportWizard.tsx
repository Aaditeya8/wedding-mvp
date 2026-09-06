"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Analysis } from "./actions";
import { analyzeUpload, checkRows, commitRows, extractDocument, previewRows } from "./actions";
import type { Answers, EventRef, Mapping } from "@/lib/import/mapping";
import type { BuildStats, ImportRow } from "@/lib/import/normalize";
import type { CommitResult } from "@/lib/import/commit";
import { UploadStep } from "./UploadStep";
import { MappingStep } from "./MappingStep";
import { ReviewGrid, blankRow, type OnExisting, type ScanInfo } from "./ReviewGrid";
import { ScanStep } from "./ScanStep";

type Step = "choose" | "upload" | "scan" | "map" | "review" | "done";
type Mode = "upload" | "direct" | "scan";

const STEP_LABELS: Record<Mode, string[]> = {
  upload: ["Source", "Match columns", "Review", "Done"],
  scan: ["Source", "Read the list", "Review", "Done"],
  direct: ["Source", "Type it in", "Review", "Done"],
};
const STEP_INDEX: Record<Step, number> = { choose: 0, upload: 0, scan: 1, map: 1, review: 2, done: 3 };

export function ImportWizard({
  weddingId,
  events,
  backHref,
  initialMode,
  aiConfigured,
}: {
  weddingId: string;
  events: EventRef[];
  backHref: string;
  initialMode: "direct" | "scan" | null;
  aiConfigured: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialMode ?? "upload");
  const [step, setStep] = useState<Step>(initialMode === "direct" ? "review" : initialMode === "scan" ? "scan" : "choose");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const allEvents = events.map((e) => e.id);
  const [rows, setRows] = useState<ImportRow[]>(initialMode === "direct" ? [blankRow(1, allEvents), blankRow(2, allEvents), blankRow(3, allEvents)] : []);
  const [stats, setStats] = useState<BuildStats | null>(null);
  const [existsCount, setExistsCount] = useState(0);
  const [onExisting, setOnExisting] = useState<OnExisting>("merge");
  const [scanInfo, setScanInfo] = useState<ScanInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset(nextMode: Mode) {
    setMode(nextMode);
    setFile(null); setAnalysis(null); setMapping(null); setAnswers({});
    setRows(nextMode === "direct" ? [blankRow(1, allEvents), blankRow(2, allEvents), blankRow(3, allEvents)] : []);
    setStats(null); setExistsCount(0); setOnExisting("merge"); setScanInfo(null); setChecked(false); setFlash(null);
    setResult(null); setError(null);
    setStep(nextMode === "direct" ? "review" : nextMode === "scan" ? "scan" : "upload");
  }

  function scan(input: { file: File | null; text: string }) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("weddingId", weddingId);
      if (input.file) fd.set("file", input.file);
      if (input.text.trim()) fd.set("text", input.text);
      const res = await extractDocument(fd);
      if (!res.ok) { setError(res.error); return; }
      setRows(res.rows);
      setStats(null);
      setExistsCount(res.existsCount);
      setScanInfo({ engine: res.engine, notes: res.notes, textPreview: res.textPreview });
      setChecked(true);
      setStep("review");
    });
  }

  function analyze(f: File, sheetIndex?: number) {
    setError(null);
    setFile(f);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("weddingId", weddingId);
      fd.set("file", f);
      if (sheetIndex !== undefined) fd.set("sheetIndex", String(sheetIndex));
      const res = await analyzeUpload(fd);
      if (!res.ok) { setError(res.error); return; }
      setAnalysis(res.analysis);
      setMapping(res.analysis.proposal.mapping);
      setAnswers(Object.fromEntries(res.analysis.proposal.questions.map((q) => [q.id, q.default])));
      setStep("map");
    });
  }

  function preview() {
    if (!analysis || !mapping) return;
    setError(null);
    startTransition(async () => {
      const res = await previewRows({ weddingId, sheet: analysis.sheet, mapping, answers });
      if (!res.ok) { setError(res.error); return; }
      setRows(res.rows);
      setStats(res.stats);
      setExistsCount(res.existsCount);
      setStep("review");
    });
  }

  function commit() {
    setError(null);
    setFlash(null);
    const live = rows.filter((r) => r.name.trim() || r.email.trim() || r.members.some((m) => m.fullName.trim()));
    if (!live.length) { setError("Add at least one household first."); return; }
    startTransition(async () => {
      // Typed-in rows haven't been compared with the list yet: do that first, and let
      // the committee choose what happens to matches before anything is written.
      if (mode === "direct" && !checked) {
        const chk = await checkRows({ weddingId, rows: live });
        if (!chk.ok) { setError(chk.error); return; }
        setChecked(true);
        if (chk.existsCount > 0) {
          setRows(chk.rows);
          setExistsCount(chk.existsCount);
          setFlash(`${chk.existsCount} of these look like households already on the list. Choose what to do with them below, then import again.`);
          return;
        }
      }
      const res = await commitRows({ weddingId, onExisting, rows: live });
      if (!res.ok) { setError(res.error); return; }
      setResult(res.result);
      setStep("done");
    });
  }

  const labels = STEP_LABELS[mode];
  const activeIndex = STEP_INDEX[step];

  return (
    <section>
      <ol className="mb-6 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400" aria-label="Progress">
        {labels.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${i <= activeIndex ? "border-stone-800 bg-stone-800 text-white" : "border-neutral-300"}`}>{i + 1}</span>
            <span className={i === activeIndex ? "text-stone-800" : ""}>{label}</span>
            {i < labels.length - 1 && <span className="mx-1 h-px w-6 bg-neutral-200" aria-hidden />}
          </li>
        ))}
      </ol>

      {error && <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      {step === "choose" && (
        <div className="grid gap-4 md:grid-cols-3">
          <button type="button" onClick={() => reset("upload")} className="portal-panel group p-6 text-left transition hover:border-stone-400">
            <p className="portal-eyebrow">Option one</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Upload a spreadsheet</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Excel or CSV, in whatever shape it already is. We read the columns, propose how they match, and ask about anything the sheet can&apos;t tell us. You correct, then review every household before it&apos;s saved.
            </p>
            <p className="mt-4 text-sm font-medium text-stone-800 group-hover:underline">Choose a file →</p>
          </button>
          <button type="button" onClick={() => reset("scan")} className="portal-panel group p-6 text-left transition hover:border-stone-400">
            <p className="portal-eyebrow">Option two</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Scan a photo or document</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              A photo of a handwritten list, a Word or PDF file, or a pasted WhatsApp message. We read it into households and merge anyone already on the list — so the aunties can keep sending additions.
            </p>
            <p className="mt-4 text-sm font-medium text-stone-800 group-hover:underline">Read a list →</p>
          </button>
          <button type="button" onClick={() => reset("direct")} className="portal-panel group p-6 text-left transition hover:border-stone-400">
            <p className="portal-eyebrow">Option three</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Type it in</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              A grid with one line per household: name, side, email, who&apos;s in it, which events. Good for a short list, or for the stragglers after an upload.
            </p>
            <p className="mt-4 text-sm font-medium text-stone-800 group-hover:underline">Open the grid →</p>
          </button>
        </div>
      )}

      {step === "upload" && (
        <UploadStep pending={pending} onFile={(f) => analyze(f)} onBack={() => setStep("choose")} />
      )}

      {step === "scan" && (
        <ScanStep pending={pending} aiConfigured={aiConfigured} onSubmit={scan} onBack={() => setStep("choose")} />
      )}

      {step === "map" && analysis && mapping && (
        <MappingStep
          analysis={analysis}
          events={events}
          mapping={mapping}
          setMapping={setMapping}
          answers={answers}
          setAnswers={setAnswers}
          pending={pending}
          onSheetChange={(i) => file && analyze(file, i)}
          onBack={() => setStep("upload")}
          onPreview={preview}
        />
      )}

      {step === "review" && (
        <ReviewGrid
          mode={mode}
          rows={rows}
          setRows={setRows}
          events={events}
          stats={stats}
          existsCount={existsCount}
          onExisting={onExisting}
          setOnExisting={setOnExisting}
          scanInfo={scanInfo}
          flash={flash}
          pending={pending}
          onBack={mode === "upload" ? () => setStep("map") : mode === "scan" ? () => setStep("scan") : () => setStep("choose")}
          onCommit={commit}
        />
      )}

      {step === "done" && result && (
        <div className="portal-panel p-6 md:p-8">
          <p className="portal-eyebrow">Import complete</p>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:max-w-md">
            {[
              ["Added", result.created],
              ["Updated", result.updated],
              ["Skipped", result.skipped],
            ].map(([label, n]) => (
              <div key={label} className="rounded-xl border border-neutral-200 bg-white p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{n}</p>
              </div>
            ))}
          </div>
          {result.errors.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-medium">{result.errors.length} household{result.errors.length === 1 ? " was" : "s were"} not saved:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.errors.map((e) => <li key={e.key}>{e.error}</li>)}
              </ul>
            </div>
          )}
          <p className="mt-5 text-sm leading-relaxed text-neutral-500">
            Nothing has been emailed yet. Send invites from guest operations when the list looks right.
            {result.updated > 0 && " “Updated” includes households that were already on the list and were merged."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={backHref} className="portal-button">Go to guest operations</Link>
            <button type="button" onClick={() => { setResult(null); setStep("choose"); }} className="portal-button-secondary">Import more</button>
          </div>
        </div>
      )}
    </section>
  );
}
