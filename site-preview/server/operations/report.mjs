// Owner reports with no AI in the loop.
// - Daily health check: Square vs the fulfillment allow list, the live Google
//   and Meta feeds vs the allow list, orders that need a person, stuck emails
//   and publish requests. It emails the owner only when something is wrong.
// - Weekly digest: orders, revenue, units, abandoned carts and open problems,
//   emailed every Monday whether or not anything is wrong.
// A check that cannot run is itself a problem, so silence always means healthy.
import { abandonedCartStats } from "../analytics/abandoned-carts.mjs";
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

/** Orders a person must look at, in plain words. */
export async function orderProblems(db, now = Date.now()) {
  const rows = await db.sql`
    SELECT square_order_id, state, provider_status, apliiq_order_id, last_error_code, created_at
    FROM aha_fulfillment_orders
    WHERE state <> 'shipped' OR last_error_code IS NOT NULL
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
    attempt("email and publishing", () => backgroundProblems(db)),
  ]);
  const problems = checks.flatMap((check) => check.problems);
  return { ok: problems.length === 0, checkedAt: now().toISOString(), variants: ids.length, checks: checks.map(({ name, problems: list }) => ({ name, problems: list })), problems };
}

/** Last seven days, from the checkout and fulfillment tables. */
export async function weeklyDigest(db, { now = () => new Date() } = {}) {
  const [sales] = await db.sql`
    SELECT count(*)::int AS orders, COALESCE(sum(total_cents), 0)::bigint AS revenue
    FROM aha_checkout_sessions
    WHERE state = 'completed' AND created_at > now() - interval '7 days'`;
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
  const problems = [...await orderProblems(db, now().getTime()), ...await backgroundProblems(db)];
  const to = now();
  return {
    from: new Date(to.getTime() - 7 * 86_400_000).toISOString(),
    to: to.toISOString(),
    orders: Number(sales?.orders ?? 0),
    revenueCents: Number(sales?.revenue ?? 0),
    units: [...units.values()].reduce((sum, value) => sum + value, 0),
    topProducts: [...units.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title, count]) => ({ title, units: count })),
    carts: carts.last7Days,
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
    heading: `${digest.orders} order${digest.orders === 1 ? "" : "s"}, ${usd(digest.revenueCents)} this week`,
    lines: [
      `${digest.units} piece${digest.units === 1 ? "" : "s"} sold.${digest.topProducts.length ? ` Best: ${digest.topProducts.map((item) => `${item.title} (${item.units})`).join(", ")}.` : ""}`,
      `Checkouts started: ${digest.carts.carts}. Paid: ${digest.carts.completed} (${conversion}%). Abandoned: ${digest.carts.abandoned}.`,
      digest.problems.length ? `${digest.problems.length} open problem(s):` : "No open problems.",
    ],
    list: digest.problems.slice(0, 20),
    links: [["Open the admin", `${siteUrl}/admin/`], ...(posthogUrl ? [["Trends and recordings in PostHog", posthogUrl]] : [])],
  });
}
