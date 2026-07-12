import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";

export async function POST() {
  if (!verifyOpsSessionToken((await cookies()).get(OPS_COOKIE)?.value)) return new NextResponse("Not found", { status: 404 });
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "Square token unavailable." }, { status: 503 });
  const headers = { Authorization: `Bearer ${token}`, "Square-Version": "2026-05-20", "Content-Type": "application/json" };
  const list = await fetch("https://connect.squareup.com/v2/webhooks/subscriptions", { headers, cache: "no-store" });
  const data = await list.json();
  const subscription = (data.subscriptions || []).find((entry: { name?: string; enabled?: boolean }) => entry.name === "AHA Netlify Square Webhook" && entry.enabled);
  if (!subscription?.id) return NextResponse.json({ error: "Enabled AHA Square subscription not found." }, { status: 409 });
  const response = await fetch(`https://connect.squareup.com/v2/webhooks/subscriptions/${subscription.id}/test`, { method: "POST", headers, body: JSON.stringify({ event_type: "payment.updated" }), cache: "no-store" });
  const result = await response.json();
  return NextResponse.json({ ok: response.ok, deliveryStatus: result.subscription_test_result?.status_code || null, errors: result.errors || [] }, { status: response.ok ? 200 : 502 });
}
