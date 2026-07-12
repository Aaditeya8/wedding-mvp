export function SummaryCards({
  summary,
}: {
  summary: { eventId: string; eventName: string; invitedFamilies: number; responded: number; attendingHeadcount: number }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {summary.map((s) => (
        <div key={s.eventId} className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{s.eventName}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{s.attendingHeadcount}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-neutral-900 transition-all"
              style={{ width: s.invitedFamilies ? `${Math.round((s.responded / s.invitedFamilies) * 100)}%` : 0 }}
            />
          </div>
          <p className="mt-1.5 text-xs text-neutral-500 tabular-nums">
            {s.responded}/{s.invitedFamilies} families answered
          </p>
        </div>
      ))}
    </div>
  );
}
