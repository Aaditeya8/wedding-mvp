"use client";

import { useRef, useState } from "react";

export function UploadStep({
  pending,
  onFile,
  onBack,
}: {
  pending: boolean;
  onFile: (file: File) => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  function accept(list: FileList | null) {
    const f = list?.[0];
    if (f) setPicked(f);
  }

  return (
    <div className="portal-panel p-6 md:p-8">
      <p className="portal-eyebrow">Upload</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">Your guest list, as it is</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500">
        Excel (.xlsx, .xls) or CSV. Any column names, any order, one person or one household per row — you&apos;ll confirm what each column means next.
      </p>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); }}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${dragging ? "border-stone-800 bg-stone-50" : "border-neutral-300 bg-white hover:border-neutral-500"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="sr-only"
          onChange={(e) => accept(e.target.files)}
          data-testid="file-input"
        />
        <span className="text-3xl" aria-hidden>⌗</span>
        {picked ? (
          <>
            <span className="mt-3 text-sm font-medium text-stone-800">{picked.name}</span>
            <span className="mt-1 text-xs text-neutral-500">{(picked.size / 1024).toFixed(0)} KB · click to change</span>
          </>
        ) : (
          <>
            <span className="mt-3 text-sm font-medium text-stone-800">Drop the file here, or click to choose</span>
            <span className="mt-1 text-xs text-neutral-500">Up to 4 MB · the first sheet with data is read; you can switch sheets after</span>
          </>
        )}
      </label>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="portal-button-secondary">← Back</button>
        <button
          type="button"
          disabled={!picked || pending}
          onClick={() => picked && onFile(picked)}
          className="portal-button disabled:opacity-40"
        >
          {pending ? "Reading your sheet…" : "Read this sheet →"}
        </button>
      </div>
    </div>
  );
}
