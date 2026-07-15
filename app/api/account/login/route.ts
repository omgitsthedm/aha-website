import { NextResponse } from "next/server";
import { consumeLoginToken, signSession, ACCOUNT_COOKIE, SESSION_MAX_AGE } from "@/lib/account/auth";

export const dynamic = "force-dynamic";

// Consumes a magic-link token, sets a signed session cookie, redirects to /account.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const email = await consumeLoginToken(token);
  const dest = new URL(email ? "/account" : "/account?error=link", url.origin);
  const res = NextResponse.redirect(dest, { status: 303 });
  if (email) {
    res.cookies.set(ACCOUNT_COOKIE, signSession(email), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE,
    });
  }
  return res;
}
