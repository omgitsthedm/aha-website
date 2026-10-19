import { POSTAL_ADDRESS } from "../platform/client.mjs";

function escape(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function money(amount, currency) { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(Number(amount || 0) / 100); }
function items(items) { return (Array.isArray(items) ? items : []).map((item) => `${item.quantity} × ${item.title}${item.size ? ` / ${item.size}` : ""}`).join("\n"); }
// The private order page link, when the deploy can sign one (server/orders/status.mjs).
const statusLink = (url) => (typeof url === "string" && url.startsWith("https://") ? url : null);
function shell({ eyebrow, heading, message, orderNumber, details, total, statusUrl }) {
  const link = statusLink(statusUrl);
  const subject = `${heading} — ${orderNumber}`;
  const html = `<!doctype html><html><body style="margin:0;background:#1a1a1a;color:#fafafa;font-family:Arial,sans-serif"><main style="max-width:620px;margin:auto;padding:40px 24px"><div style="height:8px;background:#ff6b6b"></div><p style="color:#ff6b6b;font-size:12px;font-weight:bold;letter-spacing:.08em">AFTER HOURS AGENDA / ${escape(eyebrow)}</p><h1 style="font-size:36px;line-height:1.1">${escape(heading)}</h1><p style="color:#d0d0d0;line-height:1.6">${escape(message)}</p><p><strong>Order ${escape(orderNumber)}</strong></p>${details ? `<p style="white-space:pre-line;color:#d0d0d0;line-height:1.6">${escape(details)}</p>` : ""}${total ? `<p><strong>Total ${escape(total)}</strong></p>` : ""}${link ? `<p style="margin-top:28px"><a href="${escape(link)}" style="display:inline-block;background:#ff6b6b;color:#1a1a1a;font-weight:bold;text-decoration:none;padding:14px 22px">See your order</a></p>` : ""}<p style="margin-top:32px;color:#d0d0d0">Questions? Reply to this email or write to info@afterhoursagenda.com.</p></main></body></html>`;
  return { subject, html, text: ["AFTER HOURS AGENDA", heading, message, `Order ${orderNumber}`, details, total ? `Total ${total}` : "", link ? `See your order: ${link}` : "", "Questions? info@afterhoursagenda.com"].filter(Boolean).join("\n\n") };
}

export function renderOrderConfirmation(payload) {
  return shell({ eyebrow: "Payment complete", heading: "Your order is in.", message: "Your payment is confirmed. We’re preparing your made-to-order piece and will write again when tracking is available.", orderNumber: payload.orderNumber, details: items(payload.items), total: money(payload.totalAmount, payload.currency), statusUrl: payload.statusUrl });
}
export function renderShipment(payload) {
  const tracking = payload.trackingUrl ? `Tracking: ${payload.trackingUrl}` : `${payload.carrier || "Carrier"} tracking number: ${payload.trackingNumber}`;
  return shell({ eyebrow: "Shipment update", heading: "Your tracking is ready.", message: "Tracking is now available for your shipment. The carrier may need a little time before scans appear.", orderNumber: payload.orderNumber, details: tracking, statusUrl: payload.statusUrl });
}

// Customer emails that aren't receipts: why it arrived, the store's postal
// address and a one-click unsubscribe, in both the HTML and the text part.
function customerEmail({ subject, eyebrow, heading, message, details, button, url, reason, unsubscribe }) {
  const link = statusLink(url);
  const off = statusLink(unsubscribe);
  const html = `<!doctype html><html><body style="margin:0;background:#1a1a1a;color:#fafafa;font-family:Arial,sans-serif"><main style="max-width:620px;margin:auto;padding:40px 24px"><div style="height:8px;background:#ff6b6b"></div><p style="color:#ff6b6b;font-size:12px;font-weight:bold;letter-spacing:.08em">AFTER HOURS AGENDA / ${escape(eyebrow)}</p><h1 style="font-size:36px;line-height:1.1">${escape(heading)}</h1><p style="color:#d0d0d0;line-height:1.6">${escape(message)}</p>${details ? `<p style="white-space:pre-line;color:#d0d0d0;line-height:1.6">${escape(details)}</p>` : ""}${link ? `<p style="margin-top:28px"><a href="${escape(link)}" style="display:inline-block;background:#ff6b6b;color:#1a1a1a;font-weight:bold;text-decoration:none;padding:14px 22px">${escape(button)}</a></p>` : ""}<p style="margin-top:32px;color:#d0d0d0">Questions? Reply to this email or write to info@afterhoursagenda.com.</p><p style="margin-top:40px;color:#9a9a9a;font-size:12px;line-height:1.6">${escape(reason)}${off ? ` <a href="${escape(off)}" style="color:#9a9a9a">Unsubscribe</a>.` : ""}<br>After Hours Agenda · ${escape(POSTAL_ADDRESS)}</p></main></body></html>`;
  const text = ["AFTER HOURS AGENDA", heading, message, details, link ? `${button}: ${link}` : "", "Questions? info@afterhoursagenda.com", `${reason}${off ? ` Unsubscribe: ${off}` : ""}`, `After Hours Agenda · ${POSTAL_ADDRESS}`].filter(Boolean).join("\n\n");
  return { subject, html, text };
}

export function renderCartReminder(payload, { unsubscribe } = {}) {
  return customerEmail({
    subject: "Your bag is still here",
    eyebrow: "Your bag",
    heading: "Still thinking it over?",
    message: `${payload.firstName ? `Hi ${payload.firstName}, you` : "You"} left these in your bag. They’re still there when you’re ready, made to order with free U.S. shipping.`,
    details: items(payload.items),
    button: "Back to your bag",
    url: payload.bagUrl,
    reason: "You’re getting this one reminder because you started checkout at afterhoursagenda.com.",
    unsubscribe,
  });
}

export function renderReviewRequest(payload, { unsubscribe } = {}) {
  return customerEmail({
    subject: `How’s your order? — ${payload.orderNumber}`,
    eyebrow: "Your order",
    heading: "How did it turn out?",
    message: `Order ${payload.orderNumber} should be with you by now. If you have a minute, tell us how it fits and feels. Reviews appear on the site after we read them, with a first name or “Verified buyer”.`,
    button: "Leave a review",
    url: payload.reviewUrl,
    reason: "You’re getting this because you ordered from afterhoursagenda.com. We only ask once per order.",
    unsubscribe,
  });
}
