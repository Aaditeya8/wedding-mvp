import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import { isProvisionedStaff } from "@/lib/authz";
import { recordOutbox, smtpConfigured } from "@/lib/mailer";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users as any, accountsTable: accounts as any,
    sessionsTable: sessions as any, verificationTokensTable: verificationTokens as any,
  }),
  providers: [
    Nodemailer({
      server: { service: "gmail", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } },
      from: process.env.EMAIL_FROM,
      // no SMTP: record the magic link in the outbox instead of sending
      ...(!smtpConfigured() && {
        sendVerificationRequest: async ({ identifier, url }) => {
          await recordOutbox({ to: identifier, subject: "Sign in", kind: "signin", link: url });
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
