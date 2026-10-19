// Local stand-in for the account, review, unsubscribe and order-status functions, for browser
// tests only: the real handlers (server/customers/*, server/orders/status.mjs)
// on an in-memory database. scripts/serve.mjs loads it when AHA_LOCAL_ACCOUNTS=1.
// Production runs netlify/functions/account-api.mjs, reviews.mjs and order-status.mjs.
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import products from "../src/data/products.json" with { type: "json" };
import { handleAccount } from "../server/customers/api.mjs";
import { handleReviews } from "../server/customers/reviews-api.mjs";
import { handleOrderStatus } from "../server/orders/status.mjs";
import { handleUnsubscribe } from "../server/notifications/unsubscribe.mjs";

/** Test-only signing secret for local order links; never used in production. */
export const LOCAL_ORDER_SECRET = "local-order-links-for-browser-tests";
/** A shipped local order with one Yikes! crewneck, for the review form. */
export const LOCAL_SHIPPED_ORDER = "LOCALSHIPPED0001";

export async function createLocalAccounts(port) {
  const database = new PGlite();
  const dir = new URL("../netlify/database/migrations/", import.meta.url);
  for (const name of (await readdir(dir)).filter((entry) => entry >= "20261015").sort()) await database.exec(await readFile(new URL(`${name}/migration.sql`, dir), "utf8"));
  const db = { sql: async (strings, ...values) => (await database.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), values)).rows };
  const env = { get: (key) => ({ ACCOUNT_ORIGIN: `http://localhost:${port}`, AHA_ORDER_LINK_SECRET: LOCAL_ORDER_SECRET })[key] };
  const piece = products.find((product) => product.slug === "yikes-crewneck") ?? products[0];
  await db.sql`INSERT INTO aha_fulfillment_orders (square_order_id, state, submitted_items, tracking, apliiq_payload, created_at) VALUES (${LOCAL_SHIPPED_ORDER}, 'shipped', ${JSON.stringify([{ variationId: piece.variants[0].id, sku: piece.variants[0].sku, size: piece.variants[0].size, quantity: 1, title: `${piece.title} — ${piece.color}` }])}, ${JSON.stringify([{ carrier: "USPS", number: "9400100000000000000000" }])}, ${JSON.stringify({ order_number: "LOCAL-1" })}, now() - interval '9 days')`;
  // A queued bag reminder (row 1) for the unsubscribe page.
  await db.sql`INSERT INTO aha_order_notifications (dedupe_key, kind, recipient, payload_json) VALUES ('LOCALCHECKOUT:cart_reminder', 'cart_reminder', 'shopper@example.com', '{}')`;
  const catalog = async () => ({ products });
  return async function handle(req, res, pathname) {
    const account = pathname.startsWith("/api/account/");
    const reviews = pathname === "/api/reviews" || pathname === "/api/reviews/order";
    const unsubscribe = pathname === "/api/email/unsubscribe";
    if (!account && !reviews && !unsubscribe && pathname !== "/api/orders/status") return false;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const response = account ? await handleAccount(request, { db, env, context: { ip: "127.0.0.1" }, catalog })
      : reviews ? await handleReviews(request, { db, env, catalog })
        : unsubscribe ? await handleUnsubscribe(request, { db, env })
          : await handleOrderStatus(request, { db, env });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return true;
  };
}
