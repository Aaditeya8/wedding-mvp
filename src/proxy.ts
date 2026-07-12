import { NextResponse, type NextRequest } from "next/server";

// Coarse gate only: bounce visitors with no session cookie to /signin.
// Role + wedding-ownership enforcement lives in requireRole inside every page/action —
// this never imports the auth module (database sessions can't be validated here anyway).
export function proxy(req: NextRequest) {
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");
  if (!hasSession) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/couple/:path*", "/committee/:path*", "/admin/:path*"] };
