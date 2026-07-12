import { createHmac, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";

export async function POST(request: Request) {
  if (!verifyOpsSessionToken((await cookies()).get(OPS_COOKIE)?.value)) return new NextResponse("Not found", { status: 404 });
  const secretHex = process.env.PRINTFUL_WEBHOOK_SECRET_KEY;
  if (!secretHex) return NextResponse.json({ error: "Printful webhook secret unavailable." }, { status: 503 });
  const rawBody = JSON.stringify({ type: "order_updated", occurred_at: new Date().toISOString(), retries: 0, store_id: Number(process.env.PRINTFUL_STORE_ID), data: { test_id: randomUUID(), source: "aha-production-ops" } });
  const signature = createHmac("sha256", Buffer.from(secretHex, "hex")).update(rawBody).digest("hex");
  const endpoint = new URL("/api/webhooks/printful", request.url);
  endpoint.hostname = "afterhoursagenda.netlify.app";
  endpoint.protocol = "https:";
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-pf-webhook-signature": signature, ...(process.env.PRINTFUL_WEBHOOK_PUBLIC_KEY ? { "x-pf-webhook-public-key": process.env.PRINTFUL_WEBHOOK_PUBLIC_KEY } : {}) }, body: rawBody, cache: "no-store" });
  return NextResponse.json({ ok: response.ok, deliveryStatus: response.status }, { status: response.ok ? 200 : 502 });
}
