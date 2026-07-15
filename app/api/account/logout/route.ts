import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE } from "@/lib/account/auth";
import { siteOrigin } from "@/lib/email/marketing";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.redirect(`${siteOrigin()}/account`, { status: 303 });
  res.cookies.set(ACCOUNT_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
