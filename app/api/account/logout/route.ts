import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE } from "@/lib/account/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/account", new URL(req.url).origin), { status: 303 });
  res.cookies.set(ACCOUNT_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
