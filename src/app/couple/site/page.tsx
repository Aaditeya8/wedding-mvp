import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { weddings, events } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { istParts } from "@/lib/editor";
import { EVENT_PRESETS } from "@/lib/presets";
import { fmtWeddingDate } from "@/lib/format";
import { THEMES, THEME_META } from "@/themes/catalog";
import { ShareCard } from "../ShareCard";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { SaveButton } from "./SaveButton";
import {
  saveDetails, saveRsvpSettings, saveTravel, saveEvent, addPresetEvent, toggleEvent, removeEvent, moveEventAction, sortEvents,
} from "./actions";

export const dynamic = "force-dynamic";

const Field = ({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) => (
  <label className={`block ${className}`}>
    <span className="text-xs font-medium text-neutral-600">{label}</span>
    {hint && <span className="ml-2 text-xs text-neutral-400">{hint}</span>}
    <div className="mt-1.5">{children}</div>
  </label>
);

export default async function SiteEditorPage({ searchParams }: { searchParams: Promise<{ wedding?: string; saved?: string; error?: string; section?: string }> }) {
  const staff = await requireRole(["couple", "admin"]);
  const sp = await searchParams;
  let weddingId = staff.role === "admin" ? (sp.wedding ?? null) : staff.weddingId;
  if (staff.role === "admin" && !weddingId) {
    const [first] = await db.select().from(weddings).limit(1);
    weddingId = first?.id ?? null;
  }
  if (!weddingId) return <main className="p-10 text-sm text-neutral-500">No wedding assigned to this account.</main>;

  const [w] = await db.select().from(weddings).where(eq(weddings.id, weddingId));
  const evs = await db.select().from(events).where(eq(events.weddingId, weddingId)).orderBy(events.sortOrder, events.startsAt);
  const coupleNames = `${w.brideName} & ${w.groomName}`;
  const hidden = evs.filter((e) => !e.isPublished).length;
  const wid = staff.role === "admin" ? <input type="hidden" name="weddingId" value={weddingId} /> : null;
  const stays = [...(w.travel?.stays ?? [])];
  while (stays.length < 3) stays.push({ name: "", note: "", url: "" });
  const dateParts = istParts(w.weddingDate);

  return (
    <main className="portal-page">
      <div className="portal-shell max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="portal-eyebrow">
              <Link href="/couple" className="hover:text-stone-950">{coupleNames}</Link>
              <span className="mx-1 text-stone-300">/</span> your site
            </p>
            <h1 className="portal-heading mt-2">Edit your invitation</h1>
            <p className="portal-subheading mt-3">
              Everything guests see lives here. Save a section and the site updates instantly —
              open it in another tab to watch.
            </p>
          </div>
          <a href={`/w/${w.slug}`} target="_blank" rel="noreferrer" className="portal-button-secondary">Preview site ↗</a>
        </header>

        {sp.saved && (
          <p className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
            Saved. Your site is up to date.
          </p>
        )}
        {sp.error && (
          <p className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
            Couldn&apos;t save — {sp.error === "invalid input" ? "please check the highlighted fields (names, dates and a venue are required; links must start with https://)." : sp.error}
          </p>
        )}

        <div className="space-y-8">
          <ShareCard slug={w.slug} coupleNames={coupleNames} weddingDateText={fmtWeddingDate(w.weddingDate)} compact />

          {/* ── Details ─────────────────────────────────────────── */}
          <section id="details" className="portal-panel p-6">
            <p className="portal-eyebrow">The couple</p>
            <h2 className="mt-1 font-semibold">Names, date, story</h2>
            <form action={saveDetails} className="mt-5 grid gap-4 md:grid-cols-2">
              {wid}
              <Field label="Bride's name"><input name="brideName" defaultValue={w.brideName} required maxLength={60} className="portal-input" /></Field>
              <Field label="Groom's name"><input name="groomName" defaultValue={w.groomName} required maxLength={60} className="portal-input" /></Field>
              <Field label="Wedding day"><input name="weddingDate" type="date" defaultValue={dateParts.date} required className="portal-input" /></Field>
              <Field label="City" hint="shown under the date"><input name="city" defaultValue={w.city ?? ""} maxLength={80} placeholder="Mumbai" className="portal-input" /></Field>
              <Field label="Bride's parents" hint="“with the blessings of”"><input name="brideParents" defaultValue={w.brideParents ?? ""} maxLength={160} placeholder="Sunita & Rajesh Sharma" className="portal-input" /></Field>
              <Field label="Groom's parents"><input name="groomParents" defaultValue={w.groomParents ?? ""} maxLength={160} placeholder="Kavita & Vikram Mehta" className="portal-input" /></Field>
              <Field label="Tagline" hint="one line under your names" className="md:col-span-2"><input name="heroTagline" defaultValue={w.heroTagline ?? ""} maxLength={160} placeholder="Two families, five celebrations, one big yes." className="portal-input" /></Field>
              <Field label="Your story" hint="how you met — leave blank to hide the section" className="md:col-span-2">
                <textarea name="story" defaultValue={w.story ?? ""} maxLength={2000} rows={4} className="portal-input resize-y" placeholder="They met over a spilled filter coffee at a Bengaluru hackathon…" />
              </Field>
              <Field label="Hashtag" hint="without the #"><input name="hashtag" defaultValue={w.hashtag ?? ""} maxLength={60} placeholder="AnanyaKaArjun" className="portal-input" /></Field>
              <Field label="Family contact" hint="shown if RSVPs close"><input name="contactPhone" defaultValue={w.contactPhone ?? ""} maxLength={40} placeholder="+91 98765 43210 (Rajesh)" className="portal-input" /></Field>
              <div className="md:col-span-2"><SaveButton /></div>
            </form>
          </section>

          {/* ── Theme ───────────────────────────────────────────── */}
          <div id="theme">
            <ThemeSwitcher weddingId={weddingId} current={w.theme} slug={w.slug} coupleNames={coupleNames} />
          </div>

          {/* ── Events ──────────────────────────────────────────── */}
          <section id="events" className="portal-panel p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="portal-eyebrow">The celebrations</p>
                <h2 className="mt-1 font-semibold">
                  {evs.length} event{evs.length === 1 ? "" : "s"}{hidden ? ` · ${hidden} hidden` : ""}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Switch an event off to hide it from the site and the RSVP form without deleting it — handy for family-only functions.
                </p>
              </div>
              {evs.length > 1 && (
                <form action={sortEvents}>{wid}<button className="portal-button-secondary" type="submit">Sort by date</button></form>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {evs.map((e, i) => {
                const p = istParts(e.startsAt);
                return (
                  <details key={e.id} id={`event-${e.id}`} open={sp.section === `event-${e.id}` || (sp.saved === `event-${e.id}`)}
                    className={`group rounded-xl border ${e.isPublished ? "border-neutral-200 bg-white" : "border-dashed border-neutral-300 bg-neutral-50"}`}>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
                      <span className="w-6 text-xs tabular-nums text-neutral-400">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`font-medium ${e.isPublished ? "" : "text-neutral-400 line-through decoration-neutral-300"}`}>{e.name}</span>
                        <span className="ml-2 text-xs text-neutral-400">{p.date} · {p.time} · {e.venueName}</span>
                      </span>
                      {!e.isPublished && <span className="portal-badge">hidden</span>}
                      <span className="text-xs text-neutral-400 group-open:hidden">edit ▾</span>
                      <span className="hidden text-xs text-neutral-400 group-open:inline">close ▴</span>
                    </summary>
                    <div className="border-t border-neutral-100 p-4">
                      <form action={saveEvent} className="grid gap-4 md:grid-cols-2">
                        {wid}
                        <input type="hidden" name="id" value={e.id} />
                        <Field label="Name"><input name="name" defaultValue={e.name} required maxLength={60} className="portal-input" /></Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Date"><input name="date" type="date" defaultValue={p.date} required className="portal-input" /></Field>
                          <Field label="Time (IST)"><input name="time" type="time" defaultValue={p.time} required className="portal-input" /></Field>
                        </div>
                        <Field label="Venue"><input name="venueName" defaultValue={e.venueName} required maxLength={120} className="portal-input" /></Field>
                        <Field label="Address" hint="end with the city"><input name="address" defaultValue={e.address} required maxLength={240} className="portal-input" /></Field>
                        <Field label="Map link" hint="Google Maps share link"><input name="mapUrl" type="url" defaultValue={e.mapUrl ?? ""} maxLength={500} placeholder="https://maps.app.goo.gl/…" className="portal-input" /></Field>
                        <Field label="Dress code"><input name="dressCode" defaultValue={e.dressCode ?? ""} maxLength={80} placeholder="Yellows / Traditional / Cocktail" className="portal-input" /></Field>
                        <Field label="A line about it" className="md:col-span-2"><input name="description" defaultValue={e.description ?? ""} maxLength={400} className="portal-input" /></Field>
                        <label className="flex items-center gap-2 text-sm md:col-span-2">
                          <input type="checkbox" name="isPublished" defaultChecked={e.isPublished} className="h-4 w-4" />
                          Show this event on the site and RSVP form
                        </label>
                        <div className="md:col-span-2"><SaveButton /></div>
                      </form>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                        <form action={toggleEvent}>{wid}<input type="hidden" name="id" value={e.id} /><input type="hidden" name="isPublished" value={e.isPublished ? "false" : "true"} />
                          <button type="submit" className="portal-button-secondary">{e.isPublished ? "Hide from site" : "Show on site"}</button></form>
                        <form action={moveEventAction}>{wid}<input type="hidden" name="id" value={e.id} /><input type="hidden" name="dir" value="up" />
                          <button type="submit" className="portal-button-secondary" disabled={i === 0}>↑ Move up</button></form>
                        <form action={moveEventAction}>{wid}<input type="hidden" name="id" value={e.id} /><input type="hidden" name="dir" value="down" />
                          <button type="submit" className="portal-button-secondary" disabled={i === evs.length - 1}>↓ Move down</button></form>
                        <form action={removeEvent} className="ml-auto">{wid}<input type="hidden" name="id" value={e.id} />
                          <button type="submit" className="portal-button-secondary text-red-700">Delete</button></form>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>

            <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-4">
              <p className="text-xs font-medium text-neutral-600">Add a celebration</p>
              <p className="mt-1 text-xs text-neutral-400">Tap one to add it with a sensible date, dress code and blurb — then edit the venue.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {EVENT_PRESETS.map((p) => (
                  <form key={p.name} action={addPresetEvent}>{wid}<input type="hidden" name="preset" value={p.name} />
                    <button type="submit" className="portal-badge hover:border-neutral-400 hover:text-neutral-900">+ {p.name}</button></form>
                ))}
                <form action={addPresetEvent}>{wid}<input type="hidden" name="preset" value="" />
                  <button type="submit" className="portal-badge hover:border-neutral-400 hover:text-neutral-900">+ Something else</button></form>
              </div>
            </div>
          </section>

          {/* ── Travel ──────────────────────────────────────────── */}
          <section id="travel" className="portal-panel p-6">
            <p className="portal-eyebrow">Travel &amp; stay</p>
            <h2 className="mt-1 font-semibold">Where out-of-town guests should stay</h2>
            <p className="mt-1 text-sm text-neutral-500">Leave everything blank to hide the section.</p>
            <form action={saveTravel} className="mt-5 space-y-4">
              {wid}
              {stays.map((s, i) => (
                <div key={i} className="grid gap-3 rounded-xl border border-neutral-100 p-3 md:grid-cols-3">
                  <Field label={`Hotel ${i + 1}`}><input name={`stay${i}name`} defaultValue={s.name} maxLength={120} placeholder="Taj Lands End, Bandra" className="portal-input" /></Field>
                  <Field label="Note"><input name={`stay${i}note`} defaultValue={s.note} maxLength={400} placeholder="Wedding block reserved — mention our names" className="portal-input" /></Field>
                  <Field label="Booking / map link"><input name={`stay${i}url`} type="url" defaultValue={s.url ?? ""} maxLength={500} placeholder="https://…" className="portal-input" /></Field>
                </div>
              ))}
              <Field label="Getting there" hint="airport, distances, shuttles">
                <textarea name="gettingThere" defaultValue={w.travel?.gettingThere ?? ""} maxLength={1200} rows={3} className="portal-input resize-y" placeholder="Fly into Mumbai (BOM). Both hotels are 20–40 minutes from the terminals…" />
              </Field>
              <SaveButton />
            </form>
          </section>

          {/* ── RSVP ────────────────────────────────────────────── */}
          <section id="rsvp" className="portal-panel p-6">
            <p className="portal-eyebrow">RSVP</p>
            <h2 className="mt-1 font-semibold">Who can reply, and until when</h2>
            <form action={saveRsvpSettings} className="mt-5 space-y-4">
              {wid}
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="rsvpOpen" defaultChecked={w.rsvpOpen} className="mt-0.5 h-4 w-4" />
                <span>
                  <span className="font-medium">Accept RSVPs from the shared link</span>
                  <span className="block text-xs text-neutral-500">Off = the site shows your family contact instead of the form. Emailed personal links keep working.</span>
                </span>
              </label>
              <Field label="Reply-by date" hint="optional; the form closes at midnight IST">
                <input name="rsvpDeadline" type="date" defaultValue={w.rsvpDeadline ? istParts(w.rsvpDeadline).date : ""} className="portal-input md:max-w-xs" />
              </Field>
              <SaveButton />
            </form>
          </section>

          <p className="text-center text-xs text-neutral-400">
            Theme currently <span className="font-medium text-neutral-600">{THEME_META[w.theme as (typeof THEMES)[number]]?.label}</span>. Guest list and invites live in the <Link href="/committee" className="underline">committee view</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
