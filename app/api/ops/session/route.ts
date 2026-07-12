import { NextResponse } from "next/server";
import { createOpsSessionToken, OPS_COOKIE, verifyOpsPassword } from "@/lib/ops/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  if (!verifyOpsPassword(String(form.get("password") || ""))) {
    return NextResponse.redirect(new URL("/ops/login?error=1", request.url), 303);
  }
  const response = NextResponse.redirect(new URL("/ops", request.url), 303);
  response.cookies.set(OPS_COOKIE, createOpsSessionToken(), {
    httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.redirect(new URL("/ops/login", request.url), 303);
  response.cookies.delete(OPS_COOKIE);
  return response;
}
