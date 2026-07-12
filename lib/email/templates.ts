export type OrderEmailKind = "order_confirmed" | "order_in_production" | "order_shipped" | "fulfillment_attention";

export interface OrderEmailData {
  kind: OrderEmailKind;
  orderNumber: string;
  customerName?: string | null;
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

const copy: Record<OrderEmailKind, { subject: string; eyebrow: string; heading: string; message: string }> = {
  order_confirmed: {
    subject: "Order received", eyebrow: "Payment confirmed", heading: "Your order is in",
    message: "We received your payment and are preparing your items for production.",
  },
  order_in_production: {
    subject: "Your order is in production", eyebrow: "Production started", heading: "We are making it",
    message: "Your order passed into production. We will send tracking as soon as it ships.",
  },
  order_shipped: {
    subject: "Your order shipped", eyebrow: "On the way", heading: "Your package is moving",
    message: "Your order has shipped. Use the tracking details below for the latest carrier update.",
  },
  fulfillment_attention: {
    subject: "An update on your order", eyebrow: "Production review", heading: "We are checking your order",
    message: "Your payment is complete, but our production team needs to review a fulfillment detail. You do not need to pay again. We will follow up if we need anything from you.",
  },
};

export function renderOrderEmail(data: OrderEmailData): { subject: string; html: string; text: string } {
  const state = copy[data.kind];
  const subject = `${state.subject} — ${data.orderNumber}`;
  const rows = data.items.map((item) => {
    const detail = [item.size, item.color].filter(Boolean).join(" / ");
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #343434"><strong>${escapeHtml(item.title)}</strong>${detail ? `<br><span style="color:#aaa">${escapeHtml(detail)}</span>` : ""}</td><td style="padding:12px 0;border-bottom:1px solid #343434;text-align:center">${item.quantity}</td><td style="padding:12px 0;border-bottom:1px solid #343434;text-align:right">${money(item.lineTotal, data.currency)}</td></tr>`;
  }).join("");
  const tracking = data.kind === "order_shipped" && data.trackingUrl?.startsWith("https://")
    ? `<p style="margin:28px 0"><a href="${escapeHtml(data.trackingUrl)}" style="background:#d8ff3e;color:#090909;padding:14px 20px;text-decoration:none;font-weight:800;text-transform:uppercase">Track package</a></p><p style="color:#aaa">${escapeHtml(data.carrier)} ${escapeHtml(data.trackingNumber)}</p>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#090909;color:#f5f0e6;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:40px 24px"><p style="color:#d8ff3e;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">After Hours Agenda / ${escapeHtml(state.eyebrow)}</p><h1 style="font-size:42px;line-height:.95;text-transform:uppercase;margin:18px 0">${escapeHtml(state.heading)}</h1><p style="color:#ccc;line-height:1.6">${escapeHtml(state.message)}</p><p style="margin-top:24px"><strong>Order ${escapeHtml(data.orderNumber)}</strong></p>${tracking}<table style="width:100%;border-collapse:collapse;margin-top:24px;color:#f5f0e6"><tbody>${rows}<tr><td colspan="2" style="padding-top:18px;font-weight:800;text-transform:uppercase">Total</td><td style="padding-top:18px;text-align:right;font-weight:800">${money(data.totalAmount, data.currency)}</td></tr></tbody></table><p style="margin-top:36px;color:#aaa;line-height:1.6">Questions? Reply to this email or contact info@afterhoursagenda.com. Never send card details by email.</p><p style="margin-top:36px;font-size:12px;color:#777">After Hours Agenda · New York City · afterhoursagenda.com</p></div></body></html>`;
  const text = [`AFTER HOURS AGENDA — ${state.eyebrow}`, state.heading, state.message, `Order ${data.orderNumber}`, ...data.items.map((item) => `${item.quantity}x ${item.title}${item.size ? ` / ${item.size}` : ""} — ${money(item.lineTotal, data.currency)}`), `Total: ${money(data.totalAmount, data.currency)}`, data.trackingUrl ? `Tracking: ${data.trackingUrl}` : "", "Questions: info@afterhoursagenda.com"].filter(Boolean).join("\n\n");
  return { subject, html, text };
}
