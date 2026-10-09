import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { NetlifyDB } from "@netlify/database-dev";
import { getDatabase } from "@netlify/database";
import { production, body, trackingUrl, SITE_ID } from "../server/runtime.ts";
import { orderStatus, lookupOrder } from "../server/order-status.ts";
import { metrics, parseMetric, recordMetric } from "../server/metrics.ts";
import {
  unsubscribe,
  subscribeInDatabase,
  unsubscribeInDatabase,
} from "../server/preferences.ts";
import {
  commerce,
  validateLines,
  commerceReady,
  validateContact,
} from "../server/commerce.ts";
import { cleanBag, cleanSaved } from "../src/scripts/store.ts";
import { validateCatalog } from "../src/data/catalog.ts";
const preview = {
  site: { id: SITE_ID },
  deploy: { context: "deploy-preview", published: false },
};
const prod = {
  site: { id: SITE_ID },
  deploy: { context: "production", published: true },
};
const req = (path, data, origin = "https://afterhoursagenda.com") =>
  new Request("https://afterhoursagenda.com" + path, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(data),
  });
const order = {
  orderNumber: "AHA-DEMO-1001",
  email: "review@example.com",
  postalCode: "10001",
};
test("only the exact published site and primary host can enter a production service", () => {
  assert.equal(
    production(prod, new Request("https://afterhoursagenda.com/")),
    true,
  );
  assert.equal(
    production(preview, new Request("https://afterhoursagenda.com/")),
    false,
  );
  assert.equal(
    production(
      { ...prod, site: { id: "another-site" } },
      new Request("https://afterhoursagenda.com/"),
    ),
    false,
  );
  assert.equal(
    production(prod, new Request("https://malicious.example/")),
    false,
  );
});
test("requests reject cross-origin, oversized and malformed inputs before processing", async () => {
  await assert.rejects(
    body(req("/api/order-status", order, "https://evil.example")),
    /website/,
  );
  await assert.rejects(
    body(req("/api/order-status", { payload: "x".repeat(5000) })),
    /large/,
  );
  const bad = new Request("https://afterhoursagenda.com/api/order-status", {
    method: "POST",
    headers: {
      origin: "https://afterhoursagenda.com",
      "content-type": "application/json",
    },
    body: "{",
  });
  await assert.rejects(body(bad), /Check/);
});
test("review order lookup never touches customer records and only returns the explicit fixture", async () => {
  const noDatabase = () => {
    throw new Error("Database must never be touched in preview");
  };
  const response = await orderStatus(
    req("/api/order-status", order),
    preview,
    noDatabase,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).preview, true);
  for (const key of ["email", "orderNumber", "postalCode"]) {
    const data = {
      ...order,
      [key]: key === "email" ? "someone@example.com" : "99999",
    };
    const result = await orderStatus(
      req("/api/order-status", data),
      preview,
      noDatabase,
    );
    assert.equal(result.status, 404);
  }
});
test("preview unsubscribe and metrics cannot mutate production records", async () => {
  const noDatabase = () => {
    throw new Error("Database touched");
  };
  assert.equal(
    (
      await unsubscribe(
        req("/api/unsubscribe", { email: "review@example.com" }),
        preview,
        noDatabase,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await metrics(
        req("/api/metrics", {
          event: "page_view",
          path: "/",
          device: "mobile",
          consent: true,
        }),
        preview,
        noDatabase,
      )
    ).status,
    202,
  );
});
test("measurement payloads reject identity, queries, unknown events and invalid values", () => {
  const valid = {
    event: "LCP",
    path: "/",
    device: "mobile",
    consent: true,
    value: 2500,
  };
  assert.equal(parseMetric(valid).bucket, 10);
  for (const bad of [
    { ...valid, email: "private@example.com" },
    { ...valid, path: "/?email=private@example.com" },
    { ...valid, event: "orderNumber" },
    { ...valid, value: -1 },
    { ...valid, consent: false },
    { ...valid, value: Infinity },
  ])
    assert.throws(() => parseMetric(bad));
});
test("tracking links reject unsafe schemes, lookalike domains and embedded credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://ups.com.evil.example/",
    "https://secret@ups.com/",
    "http://ups.com/",
  ])
    assert.equal(trackingUrl(url), null);
  assert.equal(
    trackingUrl("https://www.ups.com/track"),
    "https://www.ups.com/track",
  );
});
test("cart input is bounded, deduplicated and reconciled with approved inventory", () => {
  const products = [
    {
      variants: [
        {
          id: "approved",
          available: 3,
          price: 5000,
          squareVariationId: "SQ",
          providerSku: "APQ-1",
          sampleApproved: true,
          size: "M",
          color: "Black",
        },
      ],
    },
  ];
  assert.deepEqual(
    cleanBag(
      [
        { id: "approved", quantity: 10 },
        { id: "retired", quantity: 1 },
        { id: "approved", quantity: -1 },
      ],
      products,
    ),
    [{ id: "approved", quantity: 3 }],
  );
  assert.deepEqual(cleanSaved(["good", "bad", "good", "<script>"], ["good"]), [
    "good",
  ]);
  assert.throws(() =>
    validateLines([{ squareVariationId: "SQ", quantity: 4 }], products),
  );
  assert.throws(() =>
    validateLines(
      [
        { squareVariationId: "SQ", quantity: 1 },
        { squareVariationId: "SQ", quantity: 1 },
      ],
      products,
    ),
  );
  assert.equal(validateCatalog([], true).length, 1);
});
test("commerce never opens on a preview or an unapproved empty manifest", async () => {
  assert.equal(
    commerceReady(
      preview,
      new Request("https://afterhoursagenda.com/api/commerce"),
    ),
    false,
  );
  assert.equal(
    commerceReady(
      prod,
      new Request("https://afterhoursagenda.com/api/commerce"),
    ),
    false,
  );
  const response = await commerce(
    req("/api/create-payment", {
      lines: [{ squareVariationId: "FORGED", quantity: 1 }],
      quotedTotal: 1,
      sourceId: "fake",
    }),
    preview,
  );
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /Nothing has been charged/);
});
test("real local Postgres verifies lookup privacy, consent suppression and aggregate measurement", async () => {
  const engine = new NetlifyDB({ logger: () => {} });
  let database;
  try {
    const connectionString = await engine.start();
    database = getDatabase({ connectionString });
    const applied = await engine.applyMigrations(
      fileURLToPath(
        new URL("../netlify/database/migrations/", import.meta.url),
      ),
    );
    assert.equal(applied.length, 15);
    assert.equal(
      (
        await engine.applyMigrations(
          fileURLToPath(
            new URL("../netlify/database/migrations/", import.meta.url),
          ),
        )
      ).length,
      0,
    );
    const sql = database.sql;
    await sql`INSERT INTO orders(external_order_number,email,shipping_address_json,payment_status,fulfillment_status) VALUES('AHA-LOCAL-1001','local@example.com','{"zip":"10001","address1":"PRIVATE ADDRESS"}'::jsonb,'partially_refunded','shipped')`;
    await sql`INSERT INTO order_items(order_id,aha_product_id,aha_variant_id,sku,title_snapshot,size_snapshot,quantity,unit_price,line_total) VALUES(1,'local','local-m','LOCAL-M','Local fixture','M',1,5000,5000)`;
    await sql`INSERT INTO shipments(order_id,carrier,tracking_url,status) VALUES(1,'UPS','https://www.ups.com/track','in_transit'),(1,'Unverified','javascript:alert(1)','unknown')`;
    const found = await lookupOrder(
      sql,
      "AHA-LOCAL-1001",
      "local@example.com",
      "10001",
    );
    assert.match(found.customerStatus, /Partially refunded/);
    assert.equal(found.shipments[1].trackingUrl, null);
    assert.ok(!JSON.stringify(found).includes("PRIVATE ADDRESS"));
    assert.ok(!JSON.stringify(found).includes("local@example.com"));
    assert.equal(
      await lookupOrder(sql, "AHA-LOCAL-1001", "other@example.com", "10001"),
      null,
    );
    assert.equal(
      await lookupOrder(sql, "AHA-LOCAL-1001", "local@example.com", "99999"),
      null,
    );
    assert.equal(
      await lookupOrder(sql, "' OR 1=1 --", "local@example.com", "10001"),
      null,
    );
    await subscribeInDatabase(sql, "list@example.com");
    await subscribeInDatabase(sql, "list@example.com");
    await unsubscribeInDatabase(sql, "list@example.com");
    await subscribeInDatabase(sql, "list@example.com");
    assert.equal(
      (
        await sql`SELECT consent FROM email_subscribers WHERE email='list@example.com'`
      )[0].consent,
      false,
    );
    assert.equal(
      (
        await sql`SELECT unsubscribed FROM abandoned_carts WHERE email='list@example.com'`
      )[0].unsubscribed,
      true,
    );
    const metric = parseMetric({
      event: "page_view",
      path: "/",
      device: "desktop",
      consent: true,
    });
    await Promise.all([
      recordMetric(sql, metric),
      recordMetric(sql, metric),
      recordMetric(sql, metric),
    ]);
    assert.equal(
      Number((await sql`SELECT count FROM aha_site_metrics`)[0].count),
      3,
    );
  } finally {
    if (database) await database.pool.end();
    await engine.stop();
  }
});

test("checkout validates a complete US address and preserves an apartment", () => {
  const contact = {
    email: "REVIEW@example.com",
    shippingName: "Review Person",
    shippingAddress: {
      address1: "1 Test Road",
      address2: "Unit 7",
      city: "New York",
      state: "ny",
      zip: "10001",
      country: "US",
    },
  };
  assert.equal(validateContact(contact).shippingAddress.address2, "Unit 7");
  assert.equal(validateContact(contact).email, "review@example.com");
  for (const change of [
    { email: "bad" },
    { shippingName: "" },
    { shippingAddress: { ...contact.shippingAddress, country: "CA" } },
    { shippingAddress: { ...contact.shippingAddress, address1: "" } },
  ])
    assert.throws(() => validateContact({ ...contact, ...change }));
});
