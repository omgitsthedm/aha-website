import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { retryOrderFulfillment } from "@/lib/commerce/reconciliation";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyOpsSessionToken((await cookies()).get(OPS_COOKIE)?.value)) return new NextResponse("Not found", { status: 404 });
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId) || orderId < 1) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  try { await retryOrderFulfillment(orderId); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Retry failed." }, { status: 409 }); }
  return NextResponse.redirect(new URL("/ops", request.url), 303);
}
