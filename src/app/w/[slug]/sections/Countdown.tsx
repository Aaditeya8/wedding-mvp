"use client";

import { useEffect, useState } from "react";

function parts(target: Date) {
  const ms = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    mins: Math.floor(ms / 60_000) % 60,
    secs: Math.floor(ms / 1000) % 60,
  };
}

/* Live countdown to the pheras. Renders empty cells until mounted so the
   server markup never mismatches; the wrapper reserves height (no CLS). */
export function Countdown({ date }: { date: Date }) {
  const [t, setT] = useState<ReturnType<typeof parts> | null>(null);

  useEffect(() => {
    setT(parts(date));
    const id = setInterval(() => setT(parts(date)), 1000);
    return () => clearInterval(id);
  }, [date]);

  const cells: [string, number | null][] = [
    ["days", t?.days ?? null],
    ["hrs", t?.hours ?? null],
    ["min", t?.mins ?? null],
    ["sec", t?.secs ?? null],
  ];

  return (
    <div className="flex items-stretch justify-center">
      {cells.map(([label, value], i) => (
        <div
          key={label}
          className="flex min-w-[4.25rem] flex-col items-center gap-1 px-4 md:min-w-[5rem]"
          style={i > 0 ? { borderLeft: "1px solid var(--hairline)" } : undefined}
        >
          <span
            className="font-display text-3xl tabular-nums md:text-4xl"
            style={{ minHeight: "1.2em" }}
            suppressHydrationWarning
          >
            {value === null ? "" : String(value).padStart(2, "0")}
          </span>
          <span className="kicker" style={{ letterSpacing: "0.28em" }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
