import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export type Role = "admin" | "couple" | "committee";

// Where each role lands: when they open a door that isn't theirs, and where
// /go sends them after a magic link (which cannot know their role in advance).
export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  couple: "/couple",
  committee: "/committee",
};

// No self-signup: only pre-provisioned staff emails may sign in
export async function isProvisionedStaff(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  return !!existing;
}

export async function requireRole(allowed: Role[]) {
  // Lazy import keeps this module loadable in vitest without pulling in NextAuth
  const { auth } = await import("@/auth");
  const session = await auth();
  const u = session?.user as ({ id: string; role?: Role; weddingId?: string | null } | undefined);
  if (!u?.role) redirect("/signin");
  // Signed in but wrong area (e.g. couple opening /admin): bounce to their own
  // dashboard rather than crashing the request with an unhandled throw.
  if (!allowed.includes(u.role)) redirect(ROLE_HOME[u.role]);
  return { userId: u.id, role: u.role, weddingId: u.weddingId ?? null };
}
