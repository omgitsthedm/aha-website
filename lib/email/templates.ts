import { DELIVERY_WINDOW, PRODUCTION_WINDOW, RETURNS_WINDOW } from "@/lib/commerce/policies";

export type OrderEmailKind = "order_confirmed" | "order_in_production" | "order_shipped" | "fulfillment_attention";

export interface OrderEmailData {
  kind: OrderEmailKind;
  orderNumber: string;
  customerName?: string | null;
  subtotalAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  currency: string;
  items: Array<{ title: string; size?: string | null; color?: string | null; quantity: number; lineTotal: number }>;
  trackingUrl?: string;
  carrier?: string;
  trackingNumber?: string;
}

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: currency || "USD",
}).format(amount / 100);

/**
 * Canonical origin for links inside transactional email. Netlify's own URL can be
 * a deploy hostname, so the configured canonical wins. Deliberately duplicated
 * from lib/email/marketing.ts instead of imported: transactional order email must
 * not take a dependency on the marketing/lifecycle module.
 */
const siteOrigin = () => (
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || process.env.URL || "https://afterhoursagenda.com"
).replace(/\/$/, "");

// The receipt is the part of the purchase the customer keeps, so it reads the
// way the site does: thankful, plain, no urgency. Every window is the same
// constant the confirmation page and the FAQ quote.
const copy: Record<OrderEmailKind, { subject: string; eyebrow: string; heading: string; message: string }> = {
  order_confirmed: {
    subject: "Thank you — it’s being made for you", eyebrow: "Payment complete", heading: "Thank you. It’s being made for you.",
    message: `Nothing was made until you asked for it, so your order is entering production now. Printing and a quality check take ${PRODUCTION_WINDOW}; delivery is ${DELIVERY_WINDOW} after that, and you’ll get tracking the moment it ships. If the size isn’t right when it arrives, returns are on us for ${RETURNS_WINDOW}.`,
  },
  order_in_production: {
    subject: "It’s on the press", eyebrow: "In production", heading: "It’s on the press.",
    message: "Your piece is being printed and checked by hand. Tracking follows the moment it ships.",
  },
  order_shipped: {
    subject: "It’s on the way", eyebrow: "Shipped", heading: "It’s on the way.",
    message: "Your order has left production. The carrier link below has the latest, and it will keep updating until it’s in your hands.",
  },
  fulfillment_attention: {
    subject: "A quick note on your order", eyebrow: "Production review", heading: "A person is looking at your order.",
    message: "Your payment is complete and nothing needs doing on your side. Someone on our team is checking one production detail before it goes on the press; if we need anything from you, we’ll write. You will not be charged again.",
  },
};

export function renderOrderEmail(data: OrderEmailData): { subject: string; html: string; text: string } {
  const state = copy[data.kind];
  const subject = `${state.subject} — ${data.orderNumber}`;
  const rows = data.items.map((item) => {
    const detail = [item.size, item.color].filter(Boolean).join(" / ");
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #4A4A4A"><strong>${escapeHtml(item.title)}</strong>${detail ? `<br><span style="color:#B0B0B0">${escapeHtml(detail)}</span>` : ""}</td><td style="padding:12px 0;border-bottom:1px solid #4A4A4A;text-align:center">${item.quantity}</td><td style="padding:12px 0;border-bottom:1px solid #4A4A4A;text-align:right">${money(item.lineTotal, data.currency)}</td></tr>`;
  }).join("");
  const tracking = data.kind === "order_shipped" && data.trackingUrl?.startsWith("https://")
    ? `<p style="margin:28px 0"><a href="${escapeHtml(data.trackingUrl)}" style="background:#FF6B6B;color:#1A1A1A;padding:14px 20px;text-decoration:none;font-weight:700">Track package</a></p><p style="color:#B0B0B0">${escapeHtml(data.carrier)} ${escapeHtml(data.trackingNumber)}</p>` : "";
  // Self-serve status lookup, for every state except the one that already ships a
  // carrier button. The page needs the order number plus the checkout email, both
  // of which the recipient of this email has.
  const trackOrderUrl = `${siteOrigin()}/track-order`;
  const orderLookup = tracking
    ? ""
    : `<p style="margin-top:14px;color:#B0B0B0;line-height:1.6">Check the status any time at <a href="${escapeHtml(trackOrderUrl)}" style="color:#FF6B6B;font-weight:700">${escapeHtml(trackOrderUrl)}</a> using this order number and your checkout email.</p>`;
  const firstName = data.customerName?.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `<p style="color:#FAFAFA;font-size:18px;line-height:1.5;margin:0 0 12px">Hi ${escapeHtml(firstName)},</p>` : "";
  const discount = data.discountAmount ?? 0;
  const summaryRows = discount > 0
    ? `<tr><td colspan="2" style="padding-top:14px;color:#B0B0B0">Subtotal</td><td style="padding-top:14px;text-align:right;color:#B0B0B0">${money(data.subtotalAmount ?? data.totalAmount + discount, data.currency)}</td></tr><tr><td colspan="2" style="color:#8fce9b">Discount</td><td style="text-align:right;color:#8fce9b">-${money(discount, data.currency)}</td></tr>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#1A1A1A;color:#FAFAFA;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:40px 24px"><div style="height:8px;background:linear-gradient(90deg,#FF6B6B 0 25%,#87CEEB 25% 50%,#A8D5BA 50% 75%,#F0C987 75%)"></div><p style="color:#FF6B6B;font-size:12px;font-weight:700;letter-spacing:.08em">After Hours Agenda / ${escapeHtml(state.eyebrow)}</p><h1 style="font-size:40px;line-height:1;margin:18px 0">${escapeHtml(state.heading)}</h1>${greeting}<p style="color:#B0B0B0;line-height:1.6">${escapeHtml(state.message)}</p><p style="margin-top:24px"><strong>Order ${escapeHtml(data.orderNumber)}</strong></p>${orderLookup}${tracking}<table style="width:100%;border-collapse:collapse;margin-top:24px;color:#FAFAFA"><tbody>${rows}${summaryRows}<tr><td colspan="2" style="padding-top:18px;font-weight:700">Total</td><td style="padding-top:18px;text-align:right;font-weight:700">${money(data.totalAmount, data.currency)}</td></tr></tbody></table><p style="margin-top:36px;color:#B0B0B0;line-height:1.6">Questions, any time: reply to this email or write to info@afterhoursagenda.com. A person reads every one. (Never send card details by email.)</p><p style="margin-top:28px;color:#B0B0B0;line-height:1.6">Made to order means made for you. Thank you for spending some of what’s yours here.</p><p style="margin-top:36px;font-size:12px;color:#B0B0B0">After Hours Agenda · For the dreamers and the doers · afterhoursagenda.com</p></div></body></html>`;
  const text = [`AFTER HOURS AGENDA — ${state.eyebrow}`, state.heading, firstName ? `Hi ${firstName},` : "", state.message, `Order ${data.orderNumber}`, ...data.items.map((item) => `${item.quantity}x ${item.title}${item.size ? ` / ${item.size}` : ""} — ${money(item.lineTotal, data.currency)}`), discount > 0 ? `Subtotal: ${money(data.subtotalAmount ?? data.totalAmount + discount, data.currency)}` : "", discount > 0 ? `Discount: -${money(discount, data.currency)}` : "", `Total: ${money(data.totalAmount, data.currency)}`, data.trackingUrl ? `Tracking: ${data.trackingUrl}` : "", tracking ? "" : `Order status: ${trackOrderUrl}`, "Questions, any time: info@afterhoursagenda.com — a person reads every one.", "Made to order means made for you. Thank you."].filter(Boolean).join("\n\n");
  return { subject, html, text };
}
