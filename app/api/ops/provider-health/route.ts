import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ApliiqHttpError, createApliiqClient } from "@/lib/apliiq/client";
import { listApliiqOrders } from "@/lib/apliiq/orders";
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
  const apliiqApiKey = process.env.APLIIQ_API_KEY;
  const apliiqSharedSecret = process.env.APLIIQ_SHARED_SECRET;
  const apliiqConfigured = Boolean(apliiqApiKey && apliiqSharedSecret);

  const squareHeaders = {
    Authorization: `Bearer ${squareToken || ""}`,
    "Square-Version": process.env.SQUARE_API_VERSION || "2026-05-20",
    "Content-Type": "application/json",
  };

  const apliiqCheck = apliiqConfigured
    ? listApliiqOrders(createApliiqClient({
        apiKey: apliiqApiKey!,
        sharedSecret: apliiqSharedSecret!,
        fetch: (input, init) => fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        }),
      }))
        .then(() => ({ authenticated: true, status: 200 }))
        .catch((error: unknown) => ({
          authenticated: false,
          status: error instanceof ApliiqHttpError ? error.status : null,
        }))
    : Promise.resolve({ authenticated: false, status: null });

  const [locationsResponse, subscriptionsResponse, printfulResponse, apliiq] = await Promise.all([
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
    apliiqCheck,
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
    apliiq: {
      configured: apliiqConfigured,
      authenticated: apliiq.authenticated,
      status: apliiq.status,
      productCallbackConfigured: Boolean(process.env.APLIIQ_PRODUCT_CALLBACK_TOKEN),
      allowCreateOrders: process.env.APLIIQ_ALLOW_CREATE_ORDERS === "true",
      liveMode: process.env.APLIIQ_LIVE_MODE === "true",
    },
  };

  result.ok =
    result.square.authenticated &&
    result.square.webhookEnabled &&
    result.square.webhookMatches &&
    result.printful.authenticated &&
    result.printful.configuredStorePresent &&
    result.apliiq.authenticated;

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
