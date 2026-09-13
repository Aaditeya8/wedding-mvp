import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { render } from "@react-email/components";
import { db } from "@/db/client";
import { emailLog, outbox } from "@/db/schema";
import { InviteEmail } from "@/emails/InviteEmail";

type SendArgs = {
  familyId: string; to: string; familyName: string; coupleNames: string;
  rsvpUrl: string; theme: string; type: "invite" | "reminder" | "resend";
};

export const smtpConfigured = () =>
  process.env.EMAIL_MODE === "smtp" && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;

export function smtpTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/**
 * Gmail pins the envelope address to the authenticated account, but the display
 * name is ours to choose — so a wedding invite arrives from "Ananya & Arjun"
 * rather than from the platform, which is what a guest expects to see in their
 * inbox. Quotes and control characters are stripped: they would break the header.
 */
export function fromHeader(displayName?: string): string | undefined {
  const configured = process.env.EMAIL_FROM;
  const address = process.env.SMTP_USER;
  if (!displayName || !address) return configured;
  const safe = displayName.replace(/[\r\n"\\]/g, "").trim().slice(0, 78);
  return safe ? `"${safe}" <${address}>` : configured;
}

/**
 * Where mail goes when nothing can send it: a database row (readable at
 * /admin/mailroom, works on Vercel's read-only filesystem) plus, best-effort,
 * the local outbox file that dev tooling and tests read.
 */
export async function recordOutbox(m: {
  to: string; subject: string; kind: "signin" | "invite"; link?: string; html?: string;
}) {
  await db.insert(outbox).values({ to: m.to, subject: m.subject, kind: m.kind, link: m.link ?? null });
  try {
    const dir = path.join(process.cwd(), "var/outbox");
    fs.mkdirSync(dir, { recursive: true });
    const line = m.kind === "signin"
      ? { to: m.to, subject: m.subject, signInUrl: m.link, at: new Date().toISOString() }
      : { to: m.to, subject: m.subject, html: m.html, rsvpUrl: m.link, at: new Date().toISOString() };
    fs.appendFileSync(path.join(dir, "mail.jsonl"), JSON.stringify(line) + "\n");
  } catch {
    // read-only filesystem (Vercel) — the database row is the record
  }
}

async function deliver(to: string, subject: string, html: string, rsvpUrl: string, from?: string) {
  if (smtpConfigured()) {
    await smtpTransport().sendMail({ from, to, subject, html });
  } else {
    await recordOutbox({ to, subject, kind: "invite", link: rsvpUrl, html });
  }
}

export async function sendInvite(args: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const subject = `${args.coupleNames} — you're invited! Please RSVP`;
  const html = await render(InviteEmail(args));
  try {
    await deliver(args.to, subject, html, args.rsvpUrl, fromHeader(args.coupleNames));
    await db.insert(emailLog).values({ familyId: args.familyId, type: args.type, status: "sent" });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.insert(emailLog).values({ familyId: args.familyId, type: args.type, status: `failed: ${error}` });
    return { ok: false, error };
  }
}
