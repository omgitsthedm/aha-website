// Owner reports with no AI in the loop.
// - Daily health check: Square vs the fulfillment allow list, the live Google
//   and Meta feeds vs the allow list, orders that need a person, stuck emails
//   and publish requests. It emails the owner only when something is wrong.
// - Weekly digest: orders, revenue, units, abandoned carts, email sign-ups and open problems,
//   emailed every Monday whether or not anything is wrong.
// A check that cannot run is itself a problem. The separate commerce monitor
// checks worker freshness; absence of an email alone never proves health.
import { abandonedCartStats } from "../analytics/abandoned-carts.mjs";
import { signupCounts, signupProblems } from "../updates/signups.mjs";
import { orderFlags } from "../admin/orders.mjs";

const usd = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);
const label = (entry, id) => `${entry?.title ?? entry?.product ?? id}${entry?.size ? ` ${entry.size}` : ""}`;

/** Every allow-listed variation must exist in Square with the same SKU and price. */
export function compareSquareCatalog(catalog, objects) {
  const byId = new Map((objects ?? []).map((object) => [object.id, object]));
  const problems = [];
  for (const [id, entry] of Object.entries(catalog)) {
    const object = byId.get(id);
    const data = object?.item_variation_data;
    if (!object || object.is_deleted || object.type !== "ITEM_VARIATION") { problems.push(`Square: ${label(entry, id)} (${id}) is missing or deleted.`); continue; }
    if (data?.sku !== entry.sku) problems.push(`Square: ${label(entry, id)} shows SKU ${data?.sku ?? "none"}; orders are sent to Apliiq as ${entry.sku}. Run \`npm run catalog -- square-skus --apply\` so Square matches.`);
    if (data?.price_money?.amount !== entry.priceCents) problems.push(`Square: ${label(entry, id)} price is ${usd(data?.price_money?.amount)}, expected ${usd(entry.priceCents)}.`);
  }
  return problems;
}

/** Feed items keyed by id with their item-level price in cents. */
export function parseFeed(xml) {
  const items = new Map();
  for (const [, body] of String(xml ?? "").matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const id = body.match(/<g:id>([^<]+)<\/g:id>/)?.[1];
    // The item price comes before the nested <g:shipping> price.
    const price = body.replace(/<g:shipping>[\s\S]*?<\/g:shipping>/g, "").match(/<g:price>([\d.]+) USD<\/g:price>/)?.[1];
    if (id) items.set(id, price === undefined ? null : Math.round(Number(price) * 100));
  }
  return items;
}

export function compareFeed(catalog, xml, name) {
  const items = parseFeed(xml);
  const problems = [];
  if (items.size === 0) return [`${name} feed: no products found.`];
  for (const [id, entry] of Object.entries(catalog)) {
    if (!items.has(id)) problems.push(`${name} feed: ${label(entry, id)} (${id}) is missing.`);
    else if (items.get(id) !== entry.priceCents) problems.push(`${name} feed: ${label(entry, id)} shows ${usd(items.get(id))}, checkout charges ${usd(entry.priceCents)}.`);
  }
  for (const id of items.keys()) if (!catalog[id]) problems.push(`${name} feed: ${id} is advertised but can't be bought or fulfilled.`);
  return problems;
}

const CANCEL_CODES = new Set(["payment_refunded", "order_cancelled", "payment_terminal"]);

export async function pipelineProblems(db) {
  const rows = await db.sql`
    SELECT c.square_order_id,
      f.square_order_id IS NULL AS missing_fulfillment,
      n.id IS NULL AS missing_receipt,
      (n.id IS NOT NULL AND n.state <> 'sent') AS receipt_not_sent
    FROM aha_checkout_sessions c
    LEFT JOIN aha_fulfillment_orders f ON f.square_order_id = c.square_order_id
    LEFT JOIN LATERAL (SELECT * FROM aha_order_notifications nr WHERE nr.kind='order_confirmed'
      AND split_part(nr.dedupe_key,':',1)=c.square_order_id ORDER BY nr.created_at DESC,nr.id DESC LIMIT 1) n ON true
    WHERE c.state = 'completed' AND c.square_order_id IS NOT NULL
      AND c.updated_at < now() - interval '30 minutes'
      AND (f.square_order_id IS NULL OR n.id IS NULL OR n.state <> 'sent')
    ORDER BY c.created_at ASC LIMIT 200`;
  const problems = [];
  for (const row of rows) {
    if (row.missing_fulfillment) problems.push(`Paid order ${row.square_order_id}: missing from fulfillment. Check the supplier hold and signed Square event before submitting; do not charge again.`);
    if (row.missing_receipt) problems.push(`Paid order ${row.square_order_id}: confirmation email was not queued. Recover the receipt from the completed checkout.`);
    else if (row.receipt_not_sent) problems.push(`Paid order ${row.square_order_id}: confirmation email has not been sent. Check the notification outbox.`);
  }
  const [pending] = await db.sql`SELECT count(*)::int AS total FROM aha_checkout_sessions WHERE state IN ('processing', 'unknown') AND payment_submission_started_at < now() - interval '30 minutes'`;
  if (pending?.total) problems.push(`Payments: ${pending.total} attempt(s) still need Square reconciliation. Do not retry a charge until its outcome is known.`);
  return problems;
}

/** Orders a person must look at, in plain words. */
export async function orderProblems(db, now = Date.now()) {
  const rows = await db.sql`
    SELECT f.square_order_id, f.state, f.provider_status, f.apliiq_order_id, f.last_error_code, f.created_at, f.payment_created_at, f.provider_expected_at, m.refund_state,m.dispute_state,m.dispute_due_at
    FROM aha_fulfillment_orders f LEFT JOIN aha_order_financials m USING(square_order_id)
    WHERE state <> 'ignored' AND (state <> 'shipped' OR last_error_code IS NOT NULL)
    ORDER BY created_at DESC
    LIMIT 200`;
  const problems = [];
  for (const row of rows) {
    if (row.apliiq_order_id && CANCEL_CODES.has(row.last_error_code)) {
      problems.push(`Order ${row.square_order_id}: refunded or cancelled in Square after it reached Apliiq (${row.apliiq_order_id}). Cancel it in the Apliiq dashboard today; Apliiq has no cancel API.`);
      continue;
    }
    for (const flag of orderFlags(row, now)) problems.push(`Order ${row.square_order_id}: ${flag.message}`);
  }
  return problems;
}

export async function backgroundProblems(db) {
  const [mail] = await db.sql`SELECT count(*)::int AS attention FROM aha_order_notifications WHERE state = 'attention'`;
  const [publish] = await db.sql`SELECT count(*)::int AS waiting FROM aha_publish_requests WHERE status IN ('requested', 'running') AND created_at < now() - interval '24 hours'`;
  const [failed] = await db.sql`SELECT count(*)::int AS failed FROM aha_publish_requests WHERE status = 'failed' AND updated_at > now() - interval '7 days'`;
  const problems = [];
  if (mail?.attention) problems.push(`Customer email: ${mail.attention} message(s) couldn't be delivered after five tries.`);
  if (publish?.waiting) problems.push(`Publishing: ${publish.waiting} approved product(s) have waited more than a day.`);
  if (failed?.failed) problems.push(`Publishing: ${failed.failed} publish request(s) failed this week. See Products in the admin.`);
  return problems;
}

async function attempt(name, run) {
  try { return { name, problems: await run(), error: null }; }
  catch (error) { return { name, problems: [`Couldn't run the ${name} check (${error?.status ? `HTTP ${error.status}` : error?.name ?? "error"}).`], error: true }; }
}

/**
 * fetchText(url) → string; square.batchRetrieve(ids) → catalog objects.
 * Returns { ok, checkedAt, checks: [{ name, problems }], problems }.
 */
export async function runDailyHealth({ db, square, fetchText, siteUrl, catalog, saleCatalog = catalog, now = () => new Date() }) {
  const ids = Object.keys(catalog);
  const checks = await Promise.all([
    attempt("Square catalog", async () => compareSquareCatalog(catalog, await square.batchRetrieve(ids))),
    // Products removed from sale are still in Square but no longer in the feeds.
    attempt("Google feed", async () => compareFeed(saleCatalog, await fetchText(`${siteUrl}/feeds/google.xml`), "Google")),
    attempt("Meta feed", async () => compareFeed(saleCatalog, await fetchText(`${siteUrl}/feeds/meta.xml`), "Meta")),
    attempt("orders", () => orderProblems(db, now().getTime())),
    attempt("paid-order handoff", () => pipelineProblems(db)),
    attempt("email and publishing", () => backgroundProblems(db)),
    attempt("email sign-ups", () => signupProblems(db)),
  ]);
  const problems = checks.flatMap((check) => check.problems);
  return { ok: problems.length === 0, checkedAt: now().toISOString(), variants: ids.length, checks: checks.map(({ name, problems: list }) => ({ name, problems: list })), problems };
}

/** Last seven days, from the checkout and fulfillment tables. */
export async function weeklyDigest(db, { now = () => new Date() } = {}) {
  const [sales] = await db.sql`
    SELECT count(*)::int AS orders, COALESCE(sum(c.total_cents), 0)::bigint AS revenue,
      COALESCE(sum(c.subtotal_cents),0)::bigint AS merchandise,COALESCE(sum(c.shipping_cents),0)::bigint AS shipping,
      COALESCE(sum(c.tax_cents),0)::bigint AS tax,COALESCE(sum(m.refunded_cents),0)::bigint AS refunded,
      sum(m.processing_fee_cents)::bigint AS fees,count(*) FILTER(WHERE m.processing_fee_cents IS NULL)::int AS unknown_fees,
      count(*) FILTER(WHERE m.square_order_id IS NULL)::int AS unverified
    FROM aha_checkout_sessions c LEFT JOIN aha_order_financials m USING(square_order_id)
    WHERE c.state = 'completed' AND c.created_at > now() - interval '7 days'`;
  const rows = await db.sql`
    SELECT submitted_items FROM aha_fulfillment_orders WHERE created_at > now() - interval '7 days'`;
  const units = new Map();
  for (const row of rows) {
    const items = typeof row.submitted_items === "string" ? JSON.parse(row.submitted_items) : row.submitted_items ?? [];
    for (const item of items) {
      const key = item.title ?? item.product ?? item.sku;
      units.set(key, (units.get(key) ?? 0) + Number(item.quantity ?? 1));
    }
  }
  const carts = await abandonedCartStats(db.sql);
  const signups = await signupCounts(db);
  const problems = [...await orderProblems(db, now().getTime()), ...await pipelineProblems(db), ...await backgroundProblems(db)];
  const to = now();
  return {
    from: new Date(to.getTime() - 7 * 86_400_000).toISOString(),
    to: to.toISOString(),
    orders: Number(sales?.orders ?? 0),
    revenueCents: Number(sales?.revenue ?? 0),
    accounting: { gross: Number(sales?.revenue ?? 0), merchandise: Number(sales?.merchandise ?? 0), shipping: Number(sales?.shipping ?? 0), tax: Number(sales?.tax ?? 0),
      refunds: sales?.unverified ? null : Number(sales?.refunded ?? 0), fees: sales?.unknown_fees ? null : Number(sales?.fees ?? 0),
      net: sales?.unknown_fees || sales?.unverified ? null : Number(sales?.revenue ?? 0)-Number(sales?.refunded ?? 0)-Number(sales?.fees ?? 0) },
    units: [...units.values()].reduce((sum, value) => sum + value, 0),
    topProducts: [...units.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title, count]) => ({ title, units: count })),
    carts: carts.last7Days,
    signups,
    problems,
  };
}

function escape(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function email({ eyebrow, heading, lines, list, links }) {
  const html = `<!doctype html><html><body style="margin:0;background:#1a1a1a;color:#fafafa;font-family:Arial,sans-serif"><main style="max-width:620px;margin:auto;padding:40px 24px"><div style="height:8px;background:#ff6b6b"></div><p style="color:#ff6b6b;font-size:12px;font-weight:bold;letter-spacing:.08em">AFTER HOURS AGENDA / ${escape(eyebrow)}</p><h1 style="font-size:32px;line-height:1.1">${escape(heading)}</h1>${lines.map((line) => `<p style="color:#d0d0d0;line-height:1.6;margin:6px 0">${escape(line)}</p>`).join("")}${list.length ? `<ul style="color:#fafafa;line-height:1.6;padding-left:20px">${list.map((item) => `<li style="margin:6px 0">${escape(item)}</li>`).join("")}</ul>` : ""}<p style="margin-top:28px">${links.map(([text, href]) => `<a style="color:#ff6b6b;margin-right:16px" href="${escape(href)}">${escape(text)}</a>`).join("")}</p></main></body></html>`;
  const text = ["AFTER HOURS AGENDA", heading, ...lines, ...list.map((item) => `- ${item}`), ...links.map(([name, href]) => `${name}: ${href}`)].join("\n\n");
  return { subject: `${heading}`, html, text };
}

export function renderHealthEmail(report, { siteUrl }) {
  return email({
    eyebrow: "Daily check",
    heading: `${report.problems.length} thing${report.problems.length === 1 ? "" : "s"} need${report.problems.length === 1 ? "s" : ""} a look`,
    lines: [`Checked ${report.variants} sizes against Square and both product feeds, plus orders, customer email and publishing.`],
    list: report.problems.slice(0, 40),
    links: [["Open the admin", `${siteUrl}/admin/`]],
  });
}

export function renderDigestEmail(digest, { siteUrl, posthogUrl }) {
  const conversion = digest.carts.carts ? Math.round((digest.carts.completed / digest.carts.carts) * 100) : 0;
  return email({
    eyebrow: "Weekly digest",
    heading: `${digest.orders} order${digest.orders === 1 ? "" : "s"}, ${usd(digest.revenueCents)} gross receipts this week`,
    lines: [
      ...(digest.accounting ? [`Merchandise ${usd(digest.accounting.merchandise)}; shipping collected ${usd(digest.accounting.shipping)}; tax collected ${usd(digest.accounting.tax)}.`,
        `Refunds ${digest.accounting.refunds === null ? "awaiting reconciliation" : usd(digest.accounting.refunds)}; processing fees ${digest.accounting.fees === null ? "awaiting settlement" : usd(digest.accounting.fees)}; net receipts ${digest.accounting.net === null ? "not yet verified" : usd(digest.accounting.net)} (includes collected tax; excludes supplier costs). Figures cover this week's order cohort, not bank payouts.`] : []),
      `${digest.units} piece${digest.units === 1 ? "" : "s"} sold.${digest.topProducts.length ? ` Best: ${digest.topProducts.map((item) => `${item.title} (${item.units})`).join(", ")}.` : ""}`,
      `Checkouts started: ${digest.carts.carts}. Paid: ${digest.carts.completed} (${conversion}%). Abandoned: ${digest.carts.abandoned}.`,
      ...(digest.signups ? [`Email sign-ups: ${digest.signups.last7Days} new, ${digest.signups.total} on the list.`] : []),
      digest.problems.length ? `${digest.problems.length} open problem(s):` : "No open problems.",
    ],
    list: digest.problems.slice(0, 20),
    links: [["Open the admin", `${siteUrl}/admin/`], ...(posthogUrl ? [["Trends and recordings in PostHog", posthogUrl]] : [])],
  });
}
