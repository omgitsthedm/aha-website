import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/email/resend";

/**
 * Lightweight checkout alerting. When the payment/order path fails in
 * production — the customer's card charged but the DB or fulfillment didn't
 * catch up, a 500 on order creation, a webhook that couldn't process — this
 * emails the support address so a human finds out in minutes instead of never.
 *
 * Hard guarantees:
 *  - NEVER throws and NEVER blocks the caller. It lives entirely inside a
 *    try/catch and is only ever called from existing error `catch` blocks, so
 *    it cannot affect the happy path or change any status code.
 *  - Reuses the existing Resend outbox and the `ORDER_SUPPORT_EMAIL` /
 *    `RESEND_REPLY_TO` destination convention — no new env, no new dependency.
 *  - De-dupes so a burst of identical failures can't email-storm: an in-memory
 *    per-instance throttle plus a time-bucketed Resend idempotency key that
 *    collapses duplicates across serverless instances.
 */

type Severity = "critical" | "error";

interface AlertContext {
  route: string; // e.g. "create-payment"
  stage: string; // e.g. "createOrder" | "reconcile-db" | "fulfillment"
  err: unknown;
  orderNumber?: string;
  severity?: Severity; // default "error"
}

const WINDOW_MS = 5 * 60_000; // one alert per route:stage:severity per 5 minutes
const lastSent = new Map<string, number>();

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c] as string
  );

export async function reportCheckoutError(ctx: AlertContext): Promise<void> {
  try {
    // Production only — previews/branch deploys are dry-run and must stay quiet.
    if (process.env.CONTEXT && process.env.CONTEXT !== "production") return;
    if (!isTransactionalEmailConfigured()) return;

    const to = process.env.ORDER_SUPPORT_EMAIL || process.env.RESEND_REPLY_TO;
    if (!to) return;

    const severity = ctx.severity ?? "error";
    const key = `${ctx.route}:${ctx.stage}:${severity}`;
    const now = Date.now();
    const prev = lastSent.get(key);
    if (prev && now - prev < WINDOW_MS) return; // in-memory throttle (best-effort per instance)
    lastSent.set(key, now);

    const message = ctx.err instanceof Error ? ctx.err.message : String(ctx.err);
    const bucket = Math.floor(now / WINDOW_MS); // cross-instance dedup via Resend idempotency key
    const subject = `[AHA ${severity.toUpperCase()}] checkout ${ctx.route}/${ctx.stage}`;
    const lines = [
      `Route: /api/${ctx.route}`,
      `Stage: ${ctx.stage}`,
      `Severity: ${severity}`,
      ctx.orderNumber ? `Order: ${ctx.orderNumber}` : "",
      `Error: ${message.slice(0, 800)}`,
      `Time: ${new Date(now).toISOString()}`,
    ].filter(Boolean);

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;background:#FAFAFA;color:#1A1A1A;padding:24px;max-width:560px">
      <div style="height:6px;background:#FF6B6B"></div>
      <h2 style="margin:16px 0 8px">Checkout alert</h2>
      <p style="margin:0 0 16px;color:#555">An error fired in the checkout path. Details below.</p>
      <pre style="white-space:pre-wrap;background:#fff;border:1px solid #eee;padding:16px;font-size:13px">${esc(lines.join("\n"))}</pre>
    </div>`;

    await sendTransactionalEmail({
      idempotencyKey: `alert-${key}-${bucket}`,
      to,
      subject,
      html,
      text: lines.join("\n"),
    });
  } catch {
    // Alerting must never affect checkout. Swallow everything.
  }
}
