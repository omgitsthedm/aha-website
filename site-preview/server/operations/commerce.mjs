import { createHash } from "node:crypto";
import { commerceConfiguration } from "./commerce-config.mjs";
import { createResendGateway } from "../notifications/resend.mjs";
import { ownerReportConfig, SITE_URL } from "./runtime.mjs";

const MINUTE = 60_000;
const problem = (code, count = 1) => ({ code, count: Number(count) });
export async function commerceHealth({ db, env, now = () => new Date(), checkMonitor = true }) {
  const { checks } = commerceConfiguration(env);
  checks.delivery_webhook_configured = Boolean(env.get("RESEND_WEBHOOK_SECRET"));
  checks.monitor_configured = Boolean(env.get("AHA_COMMERCE_MONITOR_TOKEN"));
  const problems = Object.entries(checks).filter(([, ok]) => !ok).map(([code]) => problem(code));
  const [start] = await db.sql`SELECT created_at FROM aha_commerce_monitor WHERE id = 1`;
  if (!start) throw new Error("commerce_monitor_not_initialized");
  const [counts] = await db.sql`
    SELECT
      count(*) FILTER (WHERE f.square_order_id IS NULL AND c.updated_at < now() - interval '15 minutes')::int AS fulfillment_missing,
      count(*) FILTER (WHERE (n.id IS NULL OR n.state <> 'sent' OR n.provider_message_id IS NULL) AND c.updated_at < now() - interval '15 minutes')::int AS receipt_missing,
      count(*) FILTER (WHERE f.state IN ('attention', 'held', 'uncertain'))::int AS fulfillment_attention
    FROM aha_checkout_sessions c
    LEFT JOIN aha_fulfillment_orders f ON f.square_order_id = c.square_order_id
    LEFT JOIN LATERAL (SELECT * FROM aha_order_notifications nr WHERE nr.kind='order_confirmed'
      AND split_part(nr.dedupe_key,':',1)=c.square_order_id ORDER BY nr.created_at DESC,nr.id DESC LIMIT 1) n ON true
    WHERE c.state = 'completed' AND c.square_order_id IS NOT NULL`;
  for (const [code, count] of Object.entries(counts ?? {})) if (Number(count)) problems.push(problem(code, count));
  // Shipping mail can fail before Resend returns a message ID. A worker that
  // safely defers it still succeeds, so inspect the outbox independently.
  const [shipping] = await db.sql`SELECT count(*)::int AS count FROM aha_order_notifications
    WHERE kind = 'order_shipped' AND state <> 'sent'
      AND (state = 'attention' OR created_at < now() - interval '15 minutes')`;
  if (shipping?.count) problems.push(problem("shipping_email_unsent", shipping.count));
  const [missingShipping] = await db.sql`SELECT count(*)::int AS count FROM aha_fulfillment_orders f
    WHERE f.state IN ('shipped', 'shipped_partial', 'ready_to_ship')
      AND f.updated_at >= ${new Date(start.created_at).toISOString()} AND f.updated_at < now() - interval '15 minutes'
      AND NOT EXISTS (SELECT 1 FROM aha_order_notifications n WHERE n.kind = 'order_shipped'
        AND n.dedupe_key LIKE f.square_order_id || ':order_shipped:%')`;
  if (missingShipping?.count) problems.push(problem("shipping_email_missing", missingShipping.count));
  const hold = Number(env.get("AHA_FULFILLMENT_HOLD_MINUTES") ?? 60);
  const grace = Math.min(1_440, Math.max(0, Number.isFinite(hold) ? hold : 60)) + 90;
  const [stalled] = await db.sql`
    SELECT count(*)::int AS count FROM aha_fulfillment_orders
    WHERE apliiq_order_id IS NULL AND state NOT IN ('ignored', 'shipped', 'attention', 'held', 'uncertain')
      AND COALESCE(payment_created_at, created_at) < now() - (${grace} * interval '1 minute')`;
  if (stalled?.count) problems.push(problem("supplier_acceptance_overdue", stalled.count));
  const [payments] = await db.sql`SELECT count(*)::int AS count FROM aha_checkout_sessions
    WHERE state IN ('processing', 'unknown') AND payment_submission_started_at < now() - interval '15 minutes'`;
  if (payments?.count) problems.push(problem("payment_reconciliation_overdue", payments.count));
  const [events] = await db.sql`SELECT count(*)::int AS count FROM aha_fulfillment_square_events
    WHERE processed_at IS NULL AND received_at < now() - interval '2 hours'`;
  if (events?.count) problems.push(problem("square_events_overdue", events.count));

  const [financialBacklog] = await db.sql`SELECT count(*)::int AS count FROM aha_commerce_events WHERE processed_at IS NULL AND received_at<now()-interval '45 minutes'`;
  if(financialBacklog?.count) problems.push(problem("financial_reconciliation_overdue",financialBacklog.count));
  const [cases] = await db.sql`SELECT count(*)::int AS count FROM aha_support_cases WHERE state='open' AND created_at<now()-interval '2 days'`;
  if(cases?.count) problems.push(problem("support_cases_overdue",cases.count));
  const [supportMail] = await db.sql`SELECT count(*)::int AS count FROM aha_order_notifications WHERE kind='support_request' AND state<>'sent' AND created_at<now()-interval '15 minutes'`;
  if(supportMail?.count) problems.push(problem("support_notification_overdue",supportMail.count));
  const [tracking]=await db.sql`SELECT count(*) FILTER(WHERE delivered_at IS NULL AND (last_error_code IS NOT NULL OR checked_at<now()-interval '3 hours' OR (checked_at IS NULL AND next_attempt_at<now()-interval '30 minutes')))::int AS pending FROM aha_shipment_tracking`;
  if(tracking?.pending) problems.push(problem('carrier_tracking_needs_attention',tracking.pending));
  const [progress]=await db.sql`SELECT count(*)::int AS count FROM aha_order_notifications WHERE kind='order_progress' AND state<>'sent' AND created_at<now()-interval '30 minutes'`;
  if(progress?.count) problems.push(problem('order_progress_email_unsent',progress.count));
  // Callback metadata may arrive before the outbox's send response. Join only
  // on the returned provider ID, never an email address or unverified payload.
  const mail = await db.sql`
    SELECT n.id, n.sent_at, d.event_type FROM aha_order_notifications n
    LEFT JOIN LATERAL (
      SELECT event_type FROM aha_email_delivery_events e WHERE e.provider_message_id = n.provider_message_id
      ORDER BY occurred_at DESC,
        CASE event_type WHEN 'complained' THEN 7 WHEN 'bounced' THEN 6 WHEN 'failed' THEN 5 WHEN 'suppressed' THEN 4
          WHEN 'delivered' THEN 3 WHEN 'delivery_delayed' THEN 2 ELSE 1 END DESC LIMIT 1
    ) d ON true
    WHERE n.kind IN ('order_confirmed', 'order_shipped', 'order_progress') AND n.state = 'sent'
      AND (n.kind<>'order_confirmed' OR NOT EXISTS (SELECT 1 FROM aha_order_notifications newer
        WHERE newer.kind='order_confirmed' AND split_part(newer.dedupe_key,':',1)=split_part(n.dedupe_key,':',1)
          AND (newer.created_at,newer.id)>(n.created_at,n.id)))
      AND n.provider_message_id IS NOT NULL AND n.sent_at >= ${new Date(start.created_at).toISOString()}`;
  const failures = mail.filter((row) => ["bounced", "failed", "suppressed", "complained"].includes(row.event_type));
  const missing = mail.filter((row) => !["delivered", "bounced", "failed", "suppressed", "complained"].includes(row.event_type)
    && now().getTime() - new Date(row.sent_at).getTime() > 30 * MINUTE);
  if (failures.length) problems.push(problem("receipt_delivery_failed", failures.length));
  if (missing.length) problems.push(problem("receipt_delivery_unconfirmed", missing.length));

  const workers = await db.sql`SELECT job, created_at, last_started_at, last_succeeded_at, last_failed_at FROM aha_commerce_workers`;
  for (const job of ["fulfillment", "notifications", "square-recovery", ...(env.get("AHA_TRACKING_ENABLED")==="true" ? ["shipment-tracking"] : [])]) {
    const row = workers.find((entry) => entry.job === job);
    const limit = 45;
    if (!row || now().getTime() - new Date(row.last_succeeded_at ?? row.created_at).getTime() > limit * MINUTE)
      problems.push(problem(`${job}_worker_stale`));
    else if (row.last_failed_at && (!row.last_succeeded_at || new Date(row.last_failed_at) > new Date(row.last_succeeded_at)))
      problems.push(problem(`${job}_worker_failed`));
  }
  if (checkMonitor) {
    const [latest] = await db.sql`SELECT created_at, ok, emailed_at FROM aha_owner_reports WHERE kind = 'commerce_health' ORDER BY created_at DESC LIMIT 1`;
    if (now().getTime() - new Date(latest?.created_at ?? start.created_at).getTime() > 45 * MINUTE) problems.push(problem("commerce_monitor_stale"));
  }
  return { ok: problems.length === 0, checkedAt: now().toISOString(), checks, problems };
}

export async function runCommerceMonitor({ db, env, now = () => new Date(), mailer, inspect = commerceHealth }) {
  const report = await inspect({ db, env, now, checkMonitor: false });
  const bucket = new Date(Math.floor(now().getTime() / (15 * MINUTE)) * 15 * MINUTE).toISOString().slice(0, 16);
  const fingerprint = createHash("sha256").update(JSON.stringify(report.problems)).digest("hex").slice(0, 24);
  const key = `commerce:${bucket}:${fingerprint}`;
  const [previous] = await db.sql`SELECT summary_json, emailed_at FROM aha_owner_reports
    WHERE kind = 'commerce_health' AND emailed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1`;
  const summary = typeof previous?.summary_json === "string" ? JSON.parse(previous.summary_json) : previous?.summary_json;
  const [recovered] = previous ? await db.sql`SELECT EXISTS (SELECT 1 FROM aha_owner_reports
    WHERE kind = 'commerce_health' AND ok = true AND created_at > ${new Date(previous.emailed_at).toISOString()}) AS recovered` : [];
  await db.sql`INSERT INTO aha_owner_reports (report_key, kind, ok, summary_json)
    VALUES (${key}, 'commerce_health', ${report.ok}, ${JSON.stringify({ ...report, fingerprint })})
    ON CONFLICT (report_key) DO UPDATE SET ok = EXCLUDED.ok, summary_json = EXCLUDED.summary_json, updated_at = now()`;
  if (report.ok) return { ...report, emailed: false };
  if (!recovered?.recovered && summary?.fingerprint === fingerprint && now().getTime() - new Date(previous.emailed_at).getTime() < 6 * 60 * MINUTE)
    return { ...report, emailed: false, deduplicated: true };
  const config = ownerReportConfig(env);
  const sender = mailer ?? (config.apiKey && config.from && config.replyTo ? createResendGateway(config) : null);
  if (!sender || !config.recipient) throw new Error("commerce_alert_not_configured");
  const text = ["The store needs attention.", ...report.problems.map((entry) => `${entry.code}: ${entry.count}`),
    "Check existing payment outcomes before retrying a charge or supplier submission.", `${SITE_URL}/admin/`, "Email delivery details: https://resend.com/emails"].join("\n\n");
  const sent = await sender.send({ idempotencyKey: `aha-${key}-${fingerprint}`, recipient: config.recipient,
    subject: "Store pipeline needs attention", text, html: `<pre>${text}</pre>` });
  if (!sent?.id) throw new Error("commerce_alert_not_acknowledged");
  await db.sql`UPDATE aha_owner_reports SET emailed_at = now(), provider_message_id = ${String(sent.id)} WHERE report_key = ${key}`;
  return { ...report, emailed: true };
}
