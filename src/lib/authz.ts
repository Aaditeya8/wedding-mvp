import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export type Role = "admin" | "couple" | "committee";

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
  if (!allowed.includes(u.role)) throw new Error("forbidden");
  return { userId: u.id, role: u.role, weddingId: u.weddingId ?? null };
}
