import { NextResponse } from "next/server";
import { consumeLoginToken, signSession, ACCOUNT_COOKIE, SESSION_MAX_AGE } from "@/lib/account/auth";
import { siteOrigin } from "@/lib/email/marketing";

export const dynamic = "force-dynamic";

// Consumes a magic-link token, sets a signed session cookie, redirects to /account.
// Redirect base is the CANONICAL origin (req.url is the internal Netlify URL —
// redirecting there would scope the session cookie to the wrong domain).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const email = await consumeLoginToken(token);
  const dest = `${siteOrigin()}${email ? "/account" : "/account?error=link"}`;
  const res = NextResponse.redirect(dest, { status: 303 });
  if (email) {
    res.cookies.set(ACCOUNT_COOKIE, signSession(email), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE,
    });
  }
  return res;
}
