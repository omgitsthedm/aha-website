import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import products from "../src/data/products.json" with { type: "json" };
import { bagFromCart, cartReminderCandidates, queueCustomerEmails, reviewRequestCandidates } from "../server/notifications/customer-emails.mjs";
import { createNotificationRepository } from "../server/notifications/repository.mjs";
import { createNotificationService } from "../server/notifications/service.mjs";
import { renderCartReminder, renderReviewRequest } from "../server/notifications/templates.mjs";
import { emailHash, handleUnsubscribe, isSuppressed, unsubscribeLinks, verifyUnsubscribe } from "../server/notifications/unsubscribe.mjs";
import { POSTAL_ADDRESS } from "../server/platform/client.mjs";

const ORIGIN = "https://afterhoursagenda.com";
const env = (values = {}) => ({ get: (key) => ({ AHA_ORDER_LINK_SECRET: "customer-email-test-secret", ...values })[key] });
const crew = products.find((product) => product.slug === "yikes-crewneck");
const hoodie = products.find((product) => product.slug === "yikes-cropped-hoodie");

async function isolated(t) {
  const database = new PGlite(); t.after(() => database.close());
  const dir = new URL("../netlify/database/migrations/", import.meta.url);
  for (const name of (await readdir(dir)).filter((entry) => entry >= "20261015").sort()) await database.exec(await readFile(new URL(`${name}/migration.sql`, dir), "utf8"));
  const db = { sql: async (strings, ...values) => (await database.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), values)).rows };
  // The programs start when the migration runs; these tests look back a week.
  await db.sql`UPDATE aha_email_programs SET started_at = now() - interval '30 days'`;
  return db;
}
let counter = 0;
async function checkout(db, { email = "a@example.com", hoursAgo = 4, state = "quoted", consent = true, items = [{ variationId: crew.variants[2].id, quantity: 1 }] } = {}) {
  counter += 1;
  const id = `chk_${counter}`;
  await db.sql`INSERT INTO aha_checkout_sessions (checkout_id, token_sha256, state, cart_json, shipping_address_json, order_payload_json, subtotal_cents, shipping_cents, tax_cents, total_cents, order_idempotency_key, expires_at, marketing_json, created_at)
    VALUES (${id}, 'x', ${state}, ${JSON.stringify(items)}, ${JSON.stringify({ email, firstName: "Sam" })}, '{}', 5500, 0, 0, 5500, ${`k_${id}`}, now(), ${JSON.stringify({ marketing: { consent } })}, now() - make_interval(hours => ${hoursAgo}))`;
  return id;
}
async function shipped(db, { order = "ORDERSHIP001", email = "buyer@example.com", daysAgo = 11 } = {}) {
  await db.sql`INSERT INTO aha_fulfillment_orders (square_order_id, state, customer_email, apliiq_payload, created_at) VALUES (${order}, 'shipped', ${email}, ${JSON.stringify({ order_number: `N-${order}` })}, now() - make_interval(days => ${daysAgo + 5}))`;
  await db.sql`INSERT INTO aha_order_notifications (dedupe_key, kind, recipient, payload_json, state, sent_at) VALUES (${`${order}:order_shipped:9400`}, 'order_shipped', ${email}, '{}', 'sent', now() - make_interval(days => ${daysAgo}))`;
}

test("the customer-email migration is identical at both discovery paths and allows the two new kinds", async (t) => {
  const name = "20261019120000_customer_emails";
  assert.equal(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"), await readFile(new URL(`../../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
  const db = await isolated(t);
  for (const kind of ["order_confirmed", "order_shipped", "cart_reminder", "review_request"]) await db.sql`INSERT INTO aha_order_notifications (dedupe_key, kind, recipient, payload_json) VALUES (${`k:${kind}`}, ${kind}, 'a@example.com', '{}')`;
  await assert.rejects(db.sql`INSERT INTO aha_order_notifications (dedupe_key, kind, recipient, payload_json) VALUES ('k:x', 'newsletter', 'a@example.com', '{}')`);
  assert.deepEqual((await db.sql`SELECT name FROM aha_email_programs ORDER BY name`).map((row) => row.name), ["cart_reminder", "review_request"]);
});

test("bag reminders: three hours on, marketing on, nothing bought, not unsubscribed, once a month", async (t) => {
  const db = await isolated(t);
  const due = await checkout(db, { email: "A@Example.com" });
  await checkout(db, { email: "a@example.com", hoursAgo: 5 }); // older quote, same shopper: one reminder
  await checkout(db, { email: "soon@example.com", hoursAgo: 1 });
  await checkout(db, { email: "stale@example.com", hoursAgo: 80 });
  await checkout(db, { email: "optout@example.com", consent: false });
  await checkout(db, { email: "bought@example.com" });
  await checkout(db, { email: "bought@example.com", hoursAgo: 2, state: "completed" });
  await checkout(db, { email: "ordered@example.com" });
  await db.sql`INSERT INTO aha_fulfillment_orders (square_order_id, state, customer_email, created_at) VALUES ('ORDERED00001', 'submitted', 'Ordered@Example.com', now() - interval '2 hours')`;
  await checkout(db, { email: "gone@example.com" });
  await db.sql`INSERT INTO aha_email_suppressions (email_sha256, source) VALUES (${emailHash("gone@example.com")}, 'cart_reminder')`;
  await checkout(db, { email: "recent@example.com" });
  await db.sql`INSERT INTO aha_order_notifications (dedupe_key, kind, recipient, payload_json, created_at) VALUES ('old:cart_reminder', 'cart_reminder', 'recent@example.com', '{}', now() - interval '10 days')`;
  const rows = await cartReminderCandidates(db);
  assert.deepEqual(rows.map((row) => [row.checkout_id, row.email, row.first_name]), [[due, "a@example.com", "Sam"]]);
  // Nothing from before the program started.
  await db.sql`UPDATE aha_email_programs SET started_at = now() WHERE name = 'cart_reminder'`;
  assert.deepEqual(await cartReminderCandidates(db), []);
});

test("review requests: ten days after the shipping email, once per order, not after a review or unsubscribe", async (t) => {
  const db = await isolated(t);
  await shipped(db);
  await shipped(db, { order: "ORDERSHIP002", email: "early@example.com", daysAgo: 4 });
  await shipped(db, { order: "ORDERSHIP003", email: "reviewed@example.com" });
  await db.sql`INSERT INTO aha_reviews (square_order_id, product_slug, rating, body) VALUES ('ORDERSHIP003', ${crew.slug}, 5, 'Great')`;
  await shipped(db, { order: "ORDERSHIP004", email: "asked@example.com" });
  await db.sql`INSERT INTO aha_order_notifications (dedupe_key, kind, recipient, payload_json) VALUES ('ORDERSHIP004:review_request', 'review_request', 'asked@example.com', '{}')`;
  await shipped(db, { order: "ORDERSHIP005", email: "gone@example.com" });
  await db.sql`INSERT INTO aha_email_suppressions (email_sha256, source) VALUES (${emailHash("gone@example.com")}, 'review_request')`;
  await shipped(db, { order: "ORDERSHIP006", email: "not an email" });
  assert.deepEqual((await reviewRequestCandidates(db)).map((row) => [row.square_order_id, row.email, row.order_number]), [["ORDERSHIP001", "buyer@example.com", "N-ORDERSHIP001"]]);
  await db.sql`UPDATE aha_email_programs SET started_at = now() WHERE name = 'review_request'`;
  assert.deepEqual(await reviewRequestCandidates(db), []);
});

test("queuing turns checkouts and shipments into the two emails, with a bag link that works on any device", async (t) => {
  const db = await isolated(t);
  const id = await checkout(db, { items: [{ variationId: crew.variants[2].id, quantity: 2 }, { variationId: "GONE", quantity: 1 }, { variationId: hoodie.variants[0].id, quantity: 40 }] });
  await shipped(db);
  assert.deepEqual(bagFromCart(JSON.stringify([{ variationId: crew.variants[2].id, quantity: 2 }]), products), { items: [{ title: `${crew.title} — ${crew.color}`, size: crew.variants[2].size, quantity: 2 }], bagUrl: `${ORIGIN}/checkout/?bag=${crew.variants[2].id}:2` });
  const queued = [];
  const service = { enqueueCartReminder: async (value) => { queued.push(["cart", value]); return true; }, enqueueReviewRequest: async (value) => { queued.push(["review", value]); return true; } };
  assert.deepEqual(await queueCustomerEmails({ db, service, products, env: env() }), { enabled: true, cartReminders: 1, reviewRequests: 1 });
  assert.deepEqual(queued[0], ["cart", { recipient: "a@example.com", checkoutId: id, firstName: "Sam", items: [{ title: `${crew.title} — ${crew.color}`, size: crew.variants[2].size, quantity: 2 }, { title: `${hoodie.title} — ${hoodie.color}`, size: hoodie.variants[0].size, quantity: 10 }], bagUrl: `${ORIGIN}/checkout/?bag=${crew.variants[2].id}:2,${hoodie.variants[0].id}:10` }]);
  assert.deepEqual(queued[1], ["review", { recipient: "buyer@example.com", orderId: "ORDERSHIP001", orderNumber: "N-ORDERSHIP001" }]);
  assert.deepEqual(await queueCustomerEmails({ db, service, products, env: env({ AHA_CUSTOMER_EMAILS_ENABLED: "false" }) }), { enabled: false, cartReminders: 0, reviewRequests: 0 });
});

test("the emails carry the postal address and an unsubscribe link, and escape what shoppers typed", () => {
  assert.equal(POSTAL_ADDRESS, "12415 N 69th Drive, Peoria, Arizona 85381");
  const unsubscribe = `${ORIGIN}/unsubscribe/?n=7&k=abc`;
  const cart = renderCartReminder({ firstName: "<Sam>", items: [{ title: "Yikes! Crewneck — Bone", size: "M", quantity: 1 }], bagUrl: `${ORIGIN}/checkout/?bag=X:1` }, { unsubscribe });
  assert.equal(cart.subject, "Your bag is still here");
  for (const part of [cart.html, cart.text]) {
    assert.ok(part.includes(POSTAL_ADDRESS), "postal address");
    assert.ok(part.includes(unsubscribe.replace("&", part === cart.html ? "&amp;" : "&")), "unsubscribe link");
    assert.ok(part.includes("1 × Yikes! Crewneck — Bone / M"));
  }
  assert.ok(cart.html.includes("Hi &lt;Sam&gt;") && !cart.html.includes("<Sam>"));
  const review = renderReviewRequest({ orderNumber: "1042", reviewUrl: `${ORIGIN}/order/?o=X&k=Y#leave-a-review` }, { unsubscribe });
  assert.equal(review.subject, "How’s your order? — 1042");
  assert.ok(review.text.includes("Leave a review: https://afterhoursagenda.com/order/?o=X&k=Y#leave-a-review") && review.text.includes(POSTAL_ADDRESS));
  assert.equal(/<img|pixel|track/i.test(cart.html + review.html), false, "no tracking pixels");
});

test("sending: the customer emails go out with one-click unsubscribe headers, and never to an address that unsubscribed", async (t) => {
  const db = await isolated(t);
  const repository = createNotificationRepository(db);
  const sent = [];
  const gateway = { send: async (message) => { sent.push(message); return { id: `msg_${sent.length}` }; } };
  const suppressedSet = new Set();
  const make = (links = (id) => unsubscribeLinks(id, env())) => createNotificationService({ repository, gateway, config: { enabled: true, apiKey: "k", from: "AHA <hello@afterhoursagenda.com>", replyTo: "info@afterhoursagenda.com" }, orderLink: (order) => `${ORIGIN}/order/?o=${order}&k=sig`, unsubscribeLinks: links, suppressed: async (email) => suppressedSet.has(email) });
  const service = make();
  await service.enqueueCartReminder({ recipient: "a@example.com", checkoutId: "chk_1", firstName: "Sam", items: [{ title: "Yikes! Crewneck — Bone", size: "M", quantity: 1 }], bagUrl: `${ORIGIN}/checkout/?bag=X:1` });
  await service.enqueueReviewRequest({ recipient: "b@example.com", orderId: "ORDER1", orderNumber: "1042" });
  await service.enqueueConfirmation({ recipient: "c@example.com", orderId: "ORDER2", orderNumber: "1043", totalAmount: 5500, currency: "USD", items: [] });
  await service.enqueueReviewRequest({ recipient: "gone@example.com", orderId: "ORDER3", orderNumber: "1044" });
  suppressedSet.add("gone@example.com");
  assert.deepEqual(await service.dispatch(10), { configured: true, attempted: 4, sent: 3, deferred: 0 });
  const byRecipient = Object.fromEntries(sent.map((message) => [message.recipient, message]));
  assert.equal(byRecipient["a@example.com"].stream, "marketing");
  assert.match(byRecipient["a@example.com"].headers["List-Unsubscribe"], /^<https:\/\/afterhoursagenda\.com\/api\/email\/unsubscribe\?n=\d+&k=[\w-]{32}>$/);
  assert.equal(byRecipient["a@example.com"].headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.ok(byRecipient["b@example.com"].text.includes("#leave-a-review"));
  assert.equal(byRecipient["c@example.com"].headers, undefined, "receipts are unchanged");
  assert.equal(byRecipient["gone@example.com"], undefined);
  const [skipped] = await db.sql`SELECT state, last_error_code, provider_message_id FROM aha_order_notifications WHERE recipient = 'gone@example.com'`;
  assert.deepEqual(skipped, { state: "sent", last_error_code: "suppressed", provider_message_id: null });
  // Without a working unsubscribe link, a customer email waits instead of going out.
  const noLinks = make(() => null);
  await noLinks.enqueueCartReminder({ recipient: "d@example.com", checkoutId: "chk_2", items: [{ title: "X", size: "M", quantity: 1 }], bagUrl: `${ORIGIN}/checkout/?bag=X:1` });
  assert.deepEqual(await noLinks.dispatch(5), { configured: true, attempted: 1, sent: 0, deferred: 1 });
  // A review request needs a signed order link.
  assert.equal(await createNotificationService({ repository, gateway, config: { enabled: true, apiKey: "k", from: "f", replyTo: "r" } }).enqueueReviewRequest({ recipient: "e@example.com", orderId: "ORDER9", orderNumber: "1" }), null);
});

test("unsubscribing: signed per email, one click or the page, stored as a hash, and it clears the email list", async (t) => {
  const db = await isolated(t);
  const [row] = await db.sql`INSERT INTO aha_order_notifications (dedupe_key, kind, recipient, payload_json) VALUES ('chk_9:cart_reminder', 'cart_reminder', 'Fan@Example.com', '{}') RETURNING id`;
  await db.sql`INSERT INTO aha_email_signups (email, source, consent_text) VALUES ('fan@example.com', 'home', 'ok')`;
  const links = unsubscribeLinks(row.id, env());
  assert.match(links.page, /^https:\/\/afterhoursagenda\.com\/unsubscribe\/\?n=\d+&k=[\w-]{32}$/);
  assert.equal(links.page.includes("@") || links.oneClick.includes("@"), false, "no address in the links");
  const k = new URL(links.page).searchParams.get("k");
  assert.equal(verifyUnsubscribe(row.id, k, env()), true);
  assert.equal(verifyUnsubscribe(row.id, k, env({ AHA_ORDER_LINK_SECRET: "another-secret-entirely" })), false);
  const call = (init, url = `${ORIGIN}/api/email/unsubscribe`) => handleUnsubscribe(new Request(url, init), { db, env: env() }).then(async (response) => ({ status: response.status, body: await response.json() }));
  assert.equal((await call({ method: "GET" }, links.oneClick)).status, 404);
  assert.equal((await call({ method: "POST", body: JSON.stringify({ n: row.id, k: "wrong" }) })).status, 404);
  assert.equal((await call({ method: "POST", body: JSON.stringify({ n: 999, k }) })).status, 404);
  assert.equal(await isSuppressed(db, "fan@example.com"), false);
  // RFC 8058: the mail app posts List-Unsubscribe=One-Click to the header's URL.
  assert.deepEqual(await call({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" }, links.oneClick), { status: 200, body: { unsubscribed: true } });
  assert.equal(await isSuppressed(db, "FAN@example.com "), true);
  assert.deepEqual(await db.sql`SELECT email_sha256, source FROM aha_email_suppressions`, [{ email_sha256: emailHash("fan@example.com"), source: "cart_reminder" }]);
  assert.equal((await db.sql`SELECT count(*)::int AS n FROM aha_email_signups`)[0].n, 0, "removed from the email list too");
  assert.deepEqual(await call({ method: "POST", body: JSON.stringify({ n: row.id, k }) }), { status: 200, body: { unsubscribed: true } }, "again is fine");
});
