import { NextResponse } from "next/server";
import { createOpsSessionToken, OPS_COOKIE, OPS_SESSION_MAX_AGE, verifyOpsPassword } from "@/lib/ops/auth";
import { publicOrigin } from "@/lib/utils/origin";

export async function POST(request: Request) {
  const origin = publicOrigin(request);
  const form = await request.formData();
  if (!verifyOpsPassword(String(form.get("password") || ""))) {
    return NextResponse.redirect(new URL("/ops/login?error=1", origin), 303);
  }
  const response = NextResponse.redirect(new URL("/ops", origin), 303);
  response.cookies.set(OPS_COOKIE, createOpsSessionToken(), {
    httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: OPS_SESSION_MAX_AGE,
  });
  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.redirect(new URL("/ops/login", publicOrigin(request)), 303);
  response.cookies.delete(OPS_COOKIE);
  return response;
}
