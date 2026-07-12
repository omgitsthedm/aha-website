import { NextResponse } from "next/server";
import { OPS_COOKIE } from "@/lib/ops/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/ops/login", request.url), 303);
  response.cookies.delete(OPS_COOKIE);
  return response;
}
