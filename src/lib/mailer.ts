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

async function deliver(to: string, subject: string, html: string, rsvpUrl: string) {
  if (smtpConfigured()) {
    await smtpTransport().sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
  } else {
    await recordOutbox({ to, subject, kind: "invite", link: rsvpUrl, html });
  }
}

export async function sendInvite(args: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const subject = `${args.coupleNames} — you're invited! Please RSVP`;
  const html = await render(InviteEmail(args));
  try {
    await deliver(args.to, subject, html, args.rsvpUrl);
    await db.insert(emailLog).values({ familyId: args.familyId, type: args.type, status: "sent" });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.insert(emailLog).values({ familyId: args.familyId, type: args.type, status: `failed: ${error}` });
    return { ok: false, error };
  }
}
