// Runs one owner report (daily health check or weekly digest), records it, and
// emails the owner when it should. The report key makes a repeated scheduled
// run on the same day a no-op, and doubles as the Resend idempotency key.
import { currentCatalog } from "../catalog/current.mjs";
import { POSTHOG_PROJECT_URL, SITE_ORIGIN } from "../platform/client.mjs";
import { createSquareGateway } from "../fulfillment/square.mjs";
import { createResendGateway } from "../notifications/resend.mjs";
import { renderDigestEmail, renderHealthEmail, runDailyHealth, weeklyDigest } from "./report.mjs";

export const SITE_URL = SITE_ORIGIN;

export function reportKey(kind, date) {
  const day = date.toISOString().slice(0, 10);
  return `${kind === "daily_health" ? "health" : "digest"}:${day}`;
}

export function ownerReportConfig(env) {
  return {
    recipient: env.get("AHA_OWNER_EMAIL") || env.get("RESEND_REPLY_TO") || null,
    apiKey: env.get("RESEND_API_KEY"),
    from: env.get("RESEND_FROM_EMAIL"),
    replyTo: env.get("RESEND_REPLY_TO"),
    squareToken: env.get("AHA_SQUARE_ACCESS_TOKEN"),
    posthogUrl: env.get("PUBLIC_POSTHOG_PROJECT_URL") || POSTHOG_PROJECT_URL,
  };
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(8_000), headers: { "user-agent": "AHA-daily-health" } });
  if (!response.ok) { const error = new Error("fetch_failed"); error.status = response.status; throw error; }
  return response.text();
}

export async function latestReports(db) {
  const rows = await db.sql`
    SELECT DISTINCT ON (kind) report_key, kind, ok, summary_json, emailed_at, created_at
    FROM aha_owner_reports ORDER BY kind, created_at DESC`;
  return Object.fromEntries(rows.map((row) => [row.kind, {
    key: row.report_key,
    ok: row.ok,
    summary: typeof row.summary_json === "string" ? JSON.parse(row.summary_json) : row.summary_json,
    emailedAt: row.emailed_at ? new Date(row.emailed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }]));
}

/**
 * kind: "daily_health" | "weekly_digest". Dependencies are injectable for tests:
 * square (batchRetrieve), mailer (send), fetchImpl, now.
 */
export async function runOwnerReport(kind, { db, env, square, mailer, fetchImpl = fetch, now = () => new Date(), catalog }) {
  const config = ownerReportConfig(env);
  const key = reportKey(kind, now());
  const [existing] = await db.sql`SELECT emailed_at, ok FROM aha_owner_reports WHERE report_key = ${key}`;
  if (existing?.emailed_at || (existing && existing.ok && kind === "daily_health")) return { key, skipped: true };

  const squareClient = square ?? (config.squareToken ? createSquareGateway({ accessToken: config.squareToken }) : { batchRetrieve: async () => { throw new Error("square_not_configured"); } });
  const report = kind === "daily_health"
    // Live products are in the feeds too, so compare against the merged allow list.
    ? await runDailyHealth({ db, square: squareClient, fetchText: (url) => fetchText(url, fetchImpl), siteUrl: SITE_URL, catalog: catalog ?? (await currentCatalog()).allowList, now })
    : await weeklyDigest(db, { now });
  const ok = kind === "daily_health" ? report.ok : report.problems.length === 0;
  await db.sql`
    INSERT INTO aha_owner_reports (report_key, kind, ok, summary_json)
    VALUES (${key}, ${kind}, ${ok}, ${JSON.stringify(report)})
    ON CONFLICT (report_key) DO UPDATE SET ok = EXCLUDED.ok, summary_json = EXCLUDED.summary_json, updated_at = now()`;

  const shouldEmail = kind === "weekly_digest" || !ok;
  if (!shouldEmail) return { key, ok, emailed: false };
  const sender = mailer ?? (config.apiKey && config.from && config.replyTo ? createResendGateway({ apiKey: config.apiKey, from: config.from, replyTo: config.replyTo }) : null);
  if (!sender || !config.recipient) return { key, ok, emailed: false, reason: "email_not_configured" };
  const message = kind === "daily_health" ? renderHealthEmail(report, { siteUrl: SITE_URL }) : renderDigestEmail(report, { siteUrl: SITE_URL, posthogUrl: config.posthogUrl });
  const sent = await sender.send({ idempotencyKey: `aha-${key}`, recipient: config.recipient, ...message });
  await db.sql`UPDATE aha_owner_reports SET emailed_at = now(), provider_message_id = ${sent?.id ? String(sent.id) : null}, updated_at = now() WHERE report_key = ${key}`;
  return { key, ok, emailed: true };
}
