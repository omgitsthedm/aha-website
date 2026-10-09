import { getConnectionString } from "@netlify/database";
import {
  body,
  env,
  failure,
  HttpError,
  json,
  production,
  type Runtime,
} from "./runtime.ts";
import {
  launch,
  approvedPieces,
  validateCatalog,
} from "../src/data/catalog.ts";
export function commerceReady(context: Runtime, request: Request) {
  if (
    !production(context, request) ||
    !launch.releaseApproved ||
    !launch.policyApproved ||
    validateCatalog(approvedPieces, true).length
  )
    return false;
  if (
    ![
      "AHA_COMMERCE_ENABLED",
      "AHA_ORDER_SERVICES_ENABLED",
      "AHA_AUTOMATIONS_ENABLED",
      "APLIIQ_ALLOW_CREATE_ORDERS",
      "APLIIQ_LIVE_MODE",
    ].every((key) => env(key) === "true")
  )
    return false;
  if (
    env("AHA_FULFILLMENT_MODE") !== "auto" ||
    env("SQUARE_ENVIRONMENT") !== "production"
  )
    return false;
  if (!(env("NEXT_PUBLIC_SQUARE_APP_ID") || env("SQUARE_APPLICATION_ID")))
    return false;
  if (
    ![
      "SQUARE_ACCESS_TOKEN",
      "SQUARE_LOCATION_ID",
      "SQUARE_WEBHOOK_SIGNATURE_KEY",
      "SQUARE_WEBHOOK_NOTIFICATION_URL",
      "APLIIQ_API_KEY",
      "APLIIQ_SHARED_SECRET",
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
    ].every((key) => Boolean(env(key)))
  )
    return false;
  try {
    return Boolean(getConnectionString());
  } catch {
    return false;
  }
}
export function validateLines(value: unknown, products = approvedPieces) {
  if (!Array.isArray(value) || !value.length || value.length > 20)
    throw new HttpError(400, "Choose an available piece.");
  const ids = new Set<string>();
  const approved = new Map(
    products.flatMap((p) => p.variants).map((v) => [v.squareVariationId, v]),
  );
  return value.map((row) => {
    const v = approved.get(row?.squareVariationId);
    if (
      !v ||
      !Number.isInteger(row.quantity) ||
      row.quantity < 1 ||
      row.quantity > Math.min(10, v.available) ||
      ids.has(row.squareVariationId)
    )
      throw new HttpError(409, "A piece in your bag is no longer available.");
    ids.add(row.squareVariationId);
    return { squareVariationId: v.squareVariationId, quantity: row.quantity };
  });
}
export function validateContact(value: unknown) {
  if (!value || typeof value !== "object")
    throw new HttpError(400, "Complete your shipping details.");
  const contact = value as Record<string, unknown>;
  const address = contact.shippingAddress as
    Record<string, unknown> | undefined;
  const text = (value: unknown, max: number) =>
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= max &&
    !/[\u0000-\u001f]/.test(value);
  if (
    !text(contact.shippingName, 100) ||
    !text(contact.email, 160) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contact.email)) ||
    !address ||
    !text(address.address1, 160) ||
    !text(address.city, 100) ||
    !/^[A-Za-z]{2}$/.test(String(address.state)) ||
    !/^\d{5}(-\d{4})?$/.test(String(address.zip)) ||
    address.country !== "US" ||
    (address.address2 && !text(address.address2, 100))
  )
    throw new HttpError(
      400,
      "Check your email and complete your US shipping address.",
    );
  return {
    email: String(contact.email).trim().toLowerCase(),
    shippingName: String(contact.shippingName).trim(),
    shippingAddress: {
      address1: String(address.address1).trim(),
      address2: String(address.address2 || "").trim(),
      city: String(address.city).trim(),
      state: String(address.state).toUpperCase(),
      zip: address.zip,
      country: "US",
    },
  };
}
export async function commerce(request: Request, context: Runtime) {
  const path = new URL(request.url).pathname.replace(/\/$/, "");
  try {
    if (path === "/api/commerce") {
      if (request.method !== "GET") throw new HttpError(405, "Use GET.");
      let ready = commerceReady(context, request);
      if (ready)
        ready = (await import("../.server/legacy.mjs")).legacyCheckoutOpen();
      return json({
        ready,
        reason: ready
          ? null
          : "New orders are paused while the next collection is developed.",
        ...(ready
          ? {
              applicationId:
                env("NEXT_PUBLIC_SQUARE_APP_ID") ||
                env("SQUARE_APPLICATION_ID"),
              locationId: env("SQUARE_LOCATION_ID"),
              sdkUrl: "https://web.squarecdn.com/v1/square.js",
            }
          : {}),
      });
    }
    if (path.startsWith("/api/webhooks/")) {
      if (request.method !== "POST") throw new HttpError(405, "Use POST.");
      if (
        !production(context, request) ||
        env("AHA_ORDER_SERVICES_ENABLED") !== "true"
      )
        throw new HttpError(
          503,
          "Order services are not active in this deployment.",
        );
      const chunks: Uint8Array[] = [];
      let size = 0;
      const reader = request.body?.getReader();
      if (reader)
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > 512000) {
            await reader.cancel();
            throw new HttpError(413, "Request is too large.");
          }
          chunks.push(next.value);
        }
      // Preserve the exact signed bytes; the retained provider handlers verify signatures before work.
      const forwarded = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: Buffer.concat(chunks),
      });
      return (await import("../.server/legacy.mjs")).runLegacy(path, forwarded);
    }
    if (!["/api/checkout-quote", "/api/create-payment"].includes(path))
      throw new HttpError(404, "Not found.");
    const input = await body(request, 20000);
    if (!commerceReady(context, request))
      throw new HttpError(
        409,
        "New orders are paused. Nothing has been charged.",
      );
    const { runLegacy, legacyCheckoutOpen } =
      await import("../.server/legacy.mjs");
    if (!legacyCheckoutOpen())
      throw new HttpError(409, "The collection is not open for checkout.");
    const lines = validateLines(input.lines);
    const contact = validateContact(input.contact);
    const forwarded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ ...input, lines, contact }),
    });
    const response = await runLegacy(path, forwarded);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex");
    return response;
  } catch (error) {
    return failure(error);
  }
}
