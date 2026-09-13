"use client";

import { useActionState } from "react";
import { startWedding, type StartState } from "./actions";
import { THEMES, THEME_META } from "@/themes/catalog";

const field = { background: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--ink)" } as const;

export function StartForm({ initialTheme }: { initialTheme?: string }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startWedding, {});
  const v = state.values ?? {};
  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="mt-14 space-y-8">
      <div className="p-7 md:p-8" style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}>
        <p className="kicker">The couple</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Bride&apos;s first name</span>
            <input name="brideName" defaultValue={v.brideName} required maxLength={60} placeholder="Ananya" className="mt-1.5 w-full px-4 py-3 text-sm outline-none" style={field} />
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Groom&apos;s first name</span>
            <input name="groomName" defaultValue={v.groomName} required maxLength={60} placeholder="Arjun" className="mt-1.5 w-full px-4 py-3 text-sm outline-none" style={field} />
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Wedding day</span>
            <input name="weddingDate" type="date" defaultValue={v.weddingDate} min={minDate} required className="mt-1.5 w-full px-4 py-3 text-sm outline-none" style={field} />
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>City</span>
            <input name="city" defaultValue={v.city} required maxLength={80} placeholder="Mumbai" className="mt-1.5 w-full px-4 py-3 text-sm outline-none" style={field} />
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Your email — we&apos;ll send a sign-in link, no password</span>
            <input name="email" type="email" defaultValue={v.email} required maxLength={254} placeholder="you@gmail.com" className="mt-1.5 w-full px-4 py-3 text-sm outline-none" style={field} />
          </label>
        </div>
      </div>

      <div>
        <p className="kicker">Pick a look — change it anytime</p>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {THEMES.map((t, i) => {
            const m = THEME_META[t];
            return (
              <label key={t} className="cursor-pointer">
                <input type="radio" name="theme" value={t} defaultChecked={(v.theme || initialTheme) ? (v.theme || initialTheme) === t : i === 0} className="peer sr-only" />
                <span
                  className="block rounded-lg border p-4 transition-all peer-checked:shadow-[0_0_0_2px_var(--ink)] peer-focus-visible:shadow-[0_0_0_2px_var(--accent)]"
                  style={{ background: m.bg, color: m.ink, borderColor: "var(--hairline)" }}
                >
                  <span className="block text-2xl leading-tight" style={{ fontFamily: `${m.fontVar}, Georgia, serif` }}>A &amp; A</span>
                  <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] opacity-70">{m.label}</span>
                  <span className="mt-3 flex gap-1.5">
                    {m.dots.map((c) => <span key={c} className="h-3 w-3 rounded-full border border-black/10" style={{ background: c }} />)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm" style={{ color: "var(--accent-2)" }}>{state.error}</p>}

      <button type="submit" disabled={pending}
        className="w-full px-8 py-4 text-sm uppercase tracking-[0.2em] transition-opacity disabled:opacity-40"
        style={{ background: "var(--accent)", color: "var(--surface)" }}>
        {pending ? "Setting up…" : "Create my wedding site"}
      </button>
      <p className="text-center text-xs" style={{ color: "var(--ink-soft)" }}>
        Free while we&apos;re in pilot. No card, no app.
      </p>
    </form>
  );
}
