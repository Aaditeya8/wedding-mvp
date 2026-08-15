import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import { isProvisionedStaff } from "@/lib/authz";
import fs from "node:fs";
import path from "node:path";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users as any, accountsTable: accounts as any,
    sessionsTable: sessions as any, verificationTokensTable: verificationTokens as any,
  }),
  providers: [
    Nodemailer({
      server: { service: "gmail", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } },
      from: process.env.EMAIL_FROM,
      // file mode: write the magic link to the outbox instead of sending
      ...(process.env.EMAIL_MODE !== "smtp" && {
        sendVerificationRequest: async ({ identifier, url }) => {
          const dir = path.join(process.cwd(), "var/outbox");
          fs.mkdirSync(dir, { recursive: true });
          fs.appendFileSync(path.join(dir, "mail.jsonl"),
            JSON.stringify({ to: identifier, subject: "Sign in", signInUrl: url, at: new Date().toISOString() }) + "\n");
        },
      }),
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return isProvisionedStaff(user.email);
    },
    async session({ session, user }) {
      const [row] = await db.select().from(users).where(eq(users.id, user.id));
      (session.user as any).role = row?.role;
      (session.user as any).weddingId = row?.weddingId ?? null;
      return session;
    },
  },
  pages: { signIn: "/signin" },
});
