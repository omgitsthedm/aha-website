import { renderCartReminder, renderOrderConfirmation, renderReviewRequest, renderShipment } from "./templates.mjs";

// Emails that aren't receipts: they carry List-Unsubscribe headers, go out on
// Resend's marketing stream, and are skipped for an address that unsubscribed.
const CUSTOMER_KINDS = new Set(["cart_reminder", "review_request"]);

function validEmail(value) { return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function clean(value, fallback) { return typeof value === "string" && value.trim() ? value.trim() : fallback; }

export function createNotificationService({ repository, gateway, config, orderLink = () => null, unsubscribeLinks = () => null, suppressed = async () => false, customerEmailsEnabled = () => true, stillDue = async () => true, now = () => Date.now() }) {
  const enabled = () => config.enabled === true && Boolean(config.apiKey && config.from && config.replyTo);
  async function enqueueConfirmation({ recipient, orderId, orderNumber, totalAmount, currency, items }) {
    if (!enabled() || !validEmail(recipient)) return null;
    return repository.enqueue({ dedupeKey: `${orderId}:order_confirmed`, kind: "order_confirmed", recipient, payload: { orderNumber: clean(orderNumber, orderId), totalAmount, currency, items, statusUrl: orderLink(orderId) } });
  }
  async function enqueueShipment({ recipient, orderId, orderNumber, carrier, trackingNumber, trackingUrl }) {
    if (!enabled() || !validEmail(recipient) || !trackingNumber) return null;
    return repository.enqueue({ dedupeKey: `${orderId}:order_shipped:${trackingNumber}`, kind: "order_shipped", recipient, payload: { orderNumber: clean(orderNumber, orderId), carrier, trackingNumber, trackingUrl, statusUrl: orderLink(orderId) } });
  }
  async function enqueueCartReminder({ recipient, checkoutId, firstName, items, bagUrl }) {
    if (!enabled() || !validEmail(recipient) || !Array.isArray(items) || !items.length) return null;
    const name = typeof firstName === "string" && /^[\p{L}' .-]{1,40}$/u.test(firstName.trim()) ? firstName.trim() : null;
    return repository.enqueue({ dedupeKey: `${checkoutId}:cart_reminder`, kind: "cart_reminder", recipient, payload: { firstName: name, items, bagUrl } });
  }
  async function enqueueReviewRequest({ recipient, orderId, orderNumber }) {
    if (!enabled() || !validEmail(recipient)) return null;
    const statusUrl = orderLink(orderId);
    if (!statusUrl) return null;
    return repository.enqueue({ dedupeKey: `${orderId}:review_request`, kind: "review_request", recipient, payload: { orderNumber: clean(orderNumber, orderId), reviewUrl: `${statusUrl}#leave-a-review` } });
  }
  function render(row, links) {
    if (row.kind === "order_confirmed") return renderOrderConfirmation(row.payload_json);
    if (row.kind === "order_shipped") return renderShipment(row.payload_json);
    if (row.kind === "cart_reminder") return renderCartReminder(row.payload_json, { unsubscribe: links?.page });
    if (row.kind === "review_request") return renderReviewRequest(row.payload_json, { unsubscribe: links?.page });
    throw new Error("notification_kind_invalid");
  }
  async function dispatch(limit = 8) {
    if (!enabled()) return { configured: false, attempted: 0, sent: 0, deferred: 0 };
    // Netlify schedules have a 30-second cap. Claim each row immediately before
    // its provider request and reserve ten seconds for database cleanup.
    const maximum = Math.min(Math.max(Number(limit) || 1, 1), 20);
    const deadline = now() + 20_000;
    let attempted = 0;
    let sent = 0;
    let deferred = 0;
    while (attempted < maximum && now() < deadline) {
      const [row] = await repository.claim(1);
      if (!row) break;
      attempted += 1;
      try {
        const customer = CUSTOMER_KINDS.has(row.kind);
        // Checked again at send time: the kill switch, an unsubscribe, or a purchase or
        // review since the email was queued.
        const skip = !customer ? null
          : !customerEmailsEnabled() ? "customer_emails_disabled"
            : await suppressed(row.recipient) ? "suppressed"
              : !(await stillDue(row)) ? "no_longer_due" : null;
        if (skip) { await repository.markSkipped({ id: row.id, code: skip }); continue; }
        const links = customer ? unsubscribeLinks(row.id) : null;
        // A customer email without a working unsubscribe link is never sent.
        if (customer && !links) throw new Error("unsubscribe_unavailable");
        const message = render(row, links);
        const extra = customer ? { stream: "marketing", headers: { "List-Unsubscribe": `<${links.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {};
        const result = await gateway.send({ idempotencyKey: row.dedupe_key, recipient: row.recipient, ...message, ...extra });
        if (!result?.id) throw new Error("resend_response_invalid");
        await repository.markSent({ id: row.id, providerMessageId: String(result.id) });
        sent += 1;
      } catch (error) {
        // Every retry keeps the same provider idempotency key. A transport
        // ambiguity is therefore safely collapsed by Resend during the bounded
        // retry window; five unsuccessful attempts require operator attention.
        await repository.retryOrAttention({ id: row.id, code: Number.isInteger(error?.status) ? `resend_http_${error.status}` : "resend_delivery_unknown" });
        deferred += 1;
      }
    }
    return { configured: true, attempted, sent, deferred };
  }
  async function health() {
    if (!enabled()) return { configured: false, providerReachable: false, senderVerified: false, providerStatus: "not_configured" };
    try {
      const result = await gateway.listDomains();
      const senderDomain = String(config.from).match(/@([^>\s]+)/)?.[1]?.toLowerCase();
      const domains = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      const sender = domains.find((domain) => String(domain?.name ?? "").toLowerCase() === senderDomain);
      return { configured: true, providerReachable: true, senderVerified: Boolean(sender && ["verified", "active"].includes(String(sender.status ?? "").toLowerCase())), providerStatus: "ok" };
    } catch (error) {
      // A Resend Sending access key is valid for email delivery but intentionally
      // cannot inspect /domains. Domain verification is checked separately by an
      // authenticated account audit, so never present this as API verification.
      if (error?.resendReason === "restricted_api_key") {
        return { configured: true, providerReachable: true, senderVerified: null, providerStatus: "sending_only_key" };
      }
      const status = Number(error?.status);
      const providerStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? `resend_http_${status}` : "resend_unavailable";
      return { configured: true, providerReachable: false, senderVerified: false, providerStatus };
    }
  }
  return { enqueueConfirmation, enqueueShipment, enqueueCartReminder, enqueueReviewRequest, dispatch, health };
}
