export function NonResponders({
  families,
}: {
  families: { id: string; name: string; relation: string | null; side: string }[];
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6">
      <h2 className="font-semibold">Still waiting on</h2>
      <p className="mt-1 text-sm text-neutral-500">
        No answer yet — your committee can nudge them with one click.
      </p>
      {families.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">Everyone has answered. 🎉</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100">
          {families.map((f) => (
            <li key={f.id} className="flex items-baseline justify-between py-2.5 text-sm">
              <span className="font-medium">{f.name}</span>
              <span className="text-xs text-neutral-500">
                {f.relation ?? "—"} · {f.side}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
