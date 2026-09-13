import QRCode from "qrcode";
import { CopyButton } from "./CopyButton";
import { appOrigin } from "@/lib/origin";

/** The one thing a couple actually needs from the dashboard: the link. */
export async function ShareCard({ slug, coupleNames, weddingDateText, compact = false }: {
  slug: string; coupleNames: string; weddingDateText: string; compact?: boolean;
}) {
  const url = `${await appOrigin()}/w/${slug}`;
  const message = `${coupleNames} are getting married on ${weddingDateText} — and you're invited! 🎉\n\nSee the celebrations and RSVP here: ${url}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#1c1917", light: "#ffffff00" } });

  return (
    <section id="share" className="portal-panel p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="portal-eyebrow">Share your invitation</p>
          <h2 className="mt-1 font-semibold">One link. Every celebration, every RSVP.</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Send it on WhatsApp, put it in a family group, print the QR on the card. Guests tap, see the events, and reply — no app, no account.
          </p>
          <div className="mt-4 flex items-stretch">
            <input readOnly value={url} className="portal-input min-w-0 flex-1 rounded-r-none font-mono text-xs" />
            <CopyButton text={url} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={wa} target="_blank" rel="noreferrer" className="portal-button">Share on WhatsApp</a>
            <a href={url} target="_blank" rel="noreferrer" className="portal-button-secondary">Open site ↗</a>
            <a href={`${url}/rsvp`} target="_blank" rel="noreferrer" className="portal-button-secondary">Open RSVP form ↗</a>
          </div>
        </div>
        {!compact && (
          <div className="shrink-0 self-center rounded-xl border border-neutral-200 bg-white p-3" title="Scan to open the invitation">
            <div className="h-36 w-36 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-2 text-center text-[10px] uppercase tracking-[0.2em] text-neutral-400">scan me</p>
          </div>
        )}
      </div>
    </section>
  );
}
