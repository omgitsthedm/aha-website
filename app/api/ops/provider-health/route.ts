import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";

type SquareSubscription = {
  name?: string;
  enabled?: boolean;
  notification_url?: string;
};

type PrintfulStore = { id?: string | number };

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export async function POST() {
  if (!verifyOpsSessionToken((await cookies()).get(OPS_COOKIE)?.value)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const squareToken = process.env.SQUARE_ACCESS_TOKEN;
  const squareWebhookUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL;
  const printfulToken = process.env.PRINTFUL_API_TOKEN;
  const printfulStoreId = process.env.PRINTFUL_STORE_ID;

  const squareHeaders = {
    Authorization: `Bearer ${squareToken || ""}`,
    "Square-Version": process.env.SQUARE_API_VERSION || "2026-05-20",
    "Content-Type": "application/json",
  };

  const [locationsResponse, subscriptionsResponse, printfulResponse] = await Promise.all([
    fetch("https://connect.squareup.com/v2/locations", {
      headers: squareHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
    fetch("https://connect.squareup.com/v2/webhooks/subscriptions", {
      headers: squareHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
    fetch("https://api.printful.com/v2/stores", {
      headers: {
        Authorization: `Bearer ${printfulToken || ""}`,
        ...(printfulStoreId ? { "X-PF-Store-Id": printfulStoreId } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
  ]);

  const subscriptionsJson = await safeJson(subscriptionsResponse);
  const printfulJson = await safeJson(printfulResponse);
  const subscriptions = Array.isArray(subscriptionsJson.subscriptions)
    ? (subscriptionsJson.subscriptions as SquareSubscription[])
    : [];
  const ahaSubscription = subscriptions.find(
    (entry) => entry.name === "AHA Netlify Square Webhook" && entry.enabled,
  );
  const stores = Array.isArray(printfulJson.data) ? (printfulJson.data as PrintfulStore[]) : [];

  const result = {
    ok: false,
    square: {
      authenticated: locationsResponse.ok,
      status: locationsResponse.status,
      webhookEnabled: Boolean(ahaSubscription),
      webhookMatches: Boolean(
        ahaSubscription?.notification_url &&
          squareWebhookUrl &&
          ahaSubscription.notification_url === squareWebhookUrl,
      ),
    },
    printful: {
      authenticated: printfulResponse.ok,
      status: printfulResponse.status,
      configuredStorePresent: Boolean(
        printfulStoreId && stores.some((store) => String(store.id) === printfulStoreId),
      ),
    },
  };

  result.ok =
    result.square.authenticated &&
    result.square.webhookEnabled &&
    result.square.webhookMatches &&
    result.printful.authenticated &&
    result.printful.configuredStorePresent;

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
