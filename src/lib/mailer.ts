import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { render } from "@react-email/components";
import { db } from "@/db/client";
import { emailLog } from "@/db/schema";
import { InviteEmail } from "@/emails/InviteEmail";

type SendArgs = {
  familyId: string; to: string; familyName: string; coupleNames: string;
  rsvpUrl: string; theme: string; type: "invite" | "reminder" | "resend";
};

async function deliver(to: string, subject: string, html: string, rsvpUrl: string) {
  if (process.env.EMAIL_MODE === "smtp") {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
  } else {
    const dir = path.join(process.cwd(), "var/outbox");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "mail.jsonl"),
      JSON.stringify({ to, subject, html, rsvpUrl, at: new Date().toISOString() }) + "\n");
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
