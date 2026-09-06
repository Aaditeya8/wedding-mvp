"use client";

import { useState } from "react";

export function ScanStep({
  pending,
  aiConfigured,
  onSubmit,
  onBack,
}: {
  pending: boolean;
  aiConfigured: boolean;
  onSubmit: (input: { file: File | null; text: string }) => void;
  onBack: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const isImage = !!file && /\.(jpe?g|png|webp|gif)$/i.test(file.name);

  return (
    <div className="portal-panel p-6 md:p-8">
      <p className="portal-eyebrow">Scan</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">A photo, a document, or a pasted message</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500">
        A photo of a handwritten list, a Word or PDF document, a text file — or paste the WhatsApp message straight in. We read it into households; you check every line before it&apos;s saved. Households already on the list are recognised and merged, not duplicated.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${dragging ? "border-stone-800 bg-stone-50" : "border-neutral-300 bg-white hover:border-neutral-500"}`}
        >
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.txt,image/*,application/pdf"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            data-testid="scan-file-input"
          />
          <span className="text-3xl" aria-hidden>▣</span>
          {file ? (
            <>
              <span className="mt-3 text-sm font-medium text-stone-800">{file.name}</span>
              <span className="mt-1 text-xs text-neutral-500">{(file.size / 1024).toFixed(0)} KB · click to change</span>
            </>
          ) : (
            <>
              <span className="mt-3 text-sm font-medium text-stone-800">Photo, PDF, Word or text file</span>
              <span className="mt-1 text-xs text-neutral-500">JPG, PNG, PDF, DOCX, TXT · up to 6 MB</span>
            </>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">…or paste the list</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            placeholder={"Ladki wale\n1. Sharma family - 4\n2. Rajesh Mehta, Kavita Mehta & 2 kids\nMama ji + 3 (reception only)\n\nGroom side\n- Zoya Khan (zoya@example.com)"}
            className="portal-input mt-1 font-mono text-xs leading-relaxed"
            data-testid="scan-text"
          />
        </label>
      </div>

      {isImage && !aiConfigured && (
        <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Reading a photo needs the AI key (<code className="rounded bg-white/70 px-1">AI_API_KEY</code> in the server settings). Until then, paste the names as text or upload a Word/PDF/text file.
        </p>
      )}
      {!aiConfigured && !isImage && (
        <p className="mt-4 text-xs text-neutral-500">
          Without an AI key, text is read by the built-in rules: one household per line, counts like “- 4” or “+3”, headings such as “Bride side” or “Ladki wale”.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="portal-button-secondary">← Back</button>
        <button
          type="button"
          disabled={pending || (!file && !text.trim()) || (isImage && !aiConfigured)}
          onClick={() => onSubmit({ file, text })}
          className="portal-button disabled:opacity-40"
        >
          {pending ? (isImage ? "Reading the photo… (up to a minute)" : "Reading…") : "Read the list →"}
        </button>
      </div>
    </div>
  );
}
