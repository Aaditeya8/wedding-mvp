import { headers } from "next/headers";

/**
 * The origin this request actually arrived on.
 *
 * Guest links are the product: a couple copies one and sends it to three hundred
 * people. Deriving it from the live request means it is right on a preview
 * deployment, a custom domain, or a laptop on port 3001 — an `APP_URL` that was
 * never updated can't silently mint links nobody can open. APP_URL stays the
 * fallback for code paths with no request (scripts, tests).
 */
export async function appOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // outside a request scope (seed script, unit tests)
  }
  return process.env.APP_URL ?? "http://localhost:3000";
}
