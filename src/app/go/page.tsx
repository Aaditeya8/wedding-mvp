import { redirect } from "next/navigation";
import { ROLE_HOME, type Role } from "@/lib/authz";

export const dynamic = "force-dynamic";

/**
 * Where a magic link lands.
 *
 * The link is minted before we know who is clicking it — a couple, their
 * committee, or an admin — so it cannot name a destination. This reads the
 * session it just created and forwards to that role's home. Sending everyone
 * back to /signin instead is what made sign-in look like an infinite loop.
 */
export default async function Go() {
  const { auth } = await import("@/auth");
  const session = await auth();
  const role = (session?.user as { role?: Role } | undefined)?.role;
  redirect(role ? ROLE_HOME[role] : "/signin");
}
