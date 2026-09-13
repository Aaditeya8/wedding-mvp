import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailLog, families, outbox } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { smtpConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";


function fmtTime(iso?: string | Date) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default async function MailroomPage() {
  await requireRole(["admin"]);

  const mails = await db.select().from(outbox).orderBy(desc(outbox.at)).limit(50);
  const smtpMode = smtpConfigured();
  const log = await db.select({
    type: emailLog.type, status: emailLog.status, sentAt: emailLog.sentAt,
    familyName: families.name, familyEmail: families.email,
  }).from(emailLog)
    .leftJoin(families, eq(emailLog.familyId, families.id))
    .orderBy(desc(emailLog.sentAt)).limit(50);

  return (
    <main className="portal-page">
      <div className="portal-shell">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="portal-eyebrow">
              <Link href="/admin" className="hover:text-stone-950">Platform control room</Link>
              <span className="mx-1 text-stone-300">/</span> mailroom
            </p>
            <h1 className="portal-heading mt-2">Mailroom</h1>
            <p className="portal-subheading mt-3">
              Every email the platform sends — sign-in links and invites — in one place.
              No more digging through the outbox file mid-demo.
            </p>
          </div>
          <span className="portal-badge">
            {smtpMode ? "SMTP mode — mails go to real inboxes" : "Outbox mode — mails land here, nothing is sent"}
          </span>
        </header>

        <section className="portal-panel mb-8 overflow-x-auto">
          <div className="flex items-baseline justify-between gap-2 p-5 pb-0">
            <div>
              <p className="portal-eyebrow">Outbox</p>
              <h2 className="mt-1 font-semibold">Latest mail, newest first</h2>
            </div>
            <p className="text-xs text-neutral-400">last {mails.length} recorded</p>
          </div>
          {mails.length === 0 ? (
            <p className="p-5 pt-4 text-sm text-neutral-500">
              Nothing here yet. Request a magic link from the sign-in page or send an invite
              from the committee view — it will appear at the top of this list.
            </p>
          ) : (
            <table className="portal-table mt-4 w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>To</th>
                  <th>When</th>
                  <th className="text-right">Link</th>
                </tr>
              </thead>
              <tbody>
                {mails.map((m) => {
                  const link = m.link;
                  const isSignIn = m.kind === "signin";
                  return (
                    <tr key={m.id} className="border-b border-neutral-100 last:border-0">
                      <td>
                        <span className="portal-badge">{isSignIn ? "sign-in" : "invite"}</span>
                      </td>
                      <td>
                        <p className="font-medium text-neutral-800">{m.to}</p>
                        <p className="mt-0.5 text-xs text-neutral-400">{m.subject}</p>
                      </td>
                      <td className="whitespace-nowrap text-neutral-500">{fmtTime(m.at)}</td>
                      <td className="text-right">
                        {link ? (
                          <a href={link} target="_blank" rel="noreferrer" className="portal-button-secondary">
                            {isSignIn ? "Open sign-in link ↗" : "Open RSVP link ↗"}
                          </a>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="portal-panel overflow-x-auto">
          <div className="p-5 pb-0">
            <p className="portal-eyebrow">Delivery log</p>
            <h2 className="mt-1 font-semibold">Invite deliveries recorded in the database</h2>
          </div>
          {log.length === 0 ? (
            <p className="p-5 pt-4 text-sm text-neutral-500">
              No invites sent yet. Select families in the committee view and send invites.
            </p>
          ) : (
            <table className="portal-table mt-4 w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Family</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td><span className="portal-badge">{row.type}</span></td>
                    <td>
                      <p className="font-medium text-neutral-800">{row.familyName ?? "—"}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">{row.familyEmail ?? ""}</p>
                    </td>
                    <td className={row.status === "sent" ? "text-emerald-600" : "text-red-600"}>
                      {row.status}
                    </td>
                    <td className="whitespace-nowrap text-neutral-500">{fmtTime(row.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
