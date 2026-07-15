// Lifecycle (marketing) email templates. Brand-matched to the transactional
// order emails but with an unsubscribe + physical-address footer (CAN-SPAM).
// NOTE: MAILING_ADDRESS must be a real postal address before go-live.

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: currency || "USD",
}).format(amount / 100);

const MAILING_ADDRESS = process.env.MAILING_ADDRESS || "After Hours Agenda, New York, NY, USA";

const shell = (eyebrow: string, heading: string, bodyHtml: string, unsubUrl: string) => `<!doctype html><html><body style="margin:0;background:#1A1A1A;color:#FAFAFA;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:40px 24px"><div style="height:8px;background:linear-gradient(90deg,#FF6B6B 0 25%,#87CEEB 25% 50%,#A8D5BA 50% 75%,#F0C987 75%)"></div><p style="color:#FF6B6B;font-size:12px;font-weight:700;letter-spacing:.08em">After Hours Agenda / ${escapeHtml(eyebrow)}</p><h1 style="font-size:40px;line-height:1;margin:18px 0">${escapeHtml(heading)}</h1>${bodyHtml}<p style="margin-top:40px;font-size:12px;color:#B0B0B0;line-height:1.6">${escapeHtml(MAILING_ADDRESS)} · afterhoursagenda.com<br>You're getting this because you started an order or joined our list. <a href="${escapeHtml(unsubUrl)}" style="color:#B0B0B0">Unsubscribe</a>.</p></div></body></html>`;

export interface AbandonedCartLine { title: string; size?: string | null; quantity: number; lineTotal: number }

export function renderAbandonedCartEmail(data: {
  items: AbandonedCartLine[]; subtotal: number; currency: string; recoverUrl: string; unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "Your bag is still here";
  const rows = data.items.map((item) => {
    const detail = item.size ? `<br><span style="color:#B0B0B0">${escapeHtml(item.size)}</span>` : "";
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #4A4A4A"><strong>${escapeHtml(item.title)}</strong>${detail}</td><td style="padding:12px 0;border-bottom:1px solid #4A4A4A;text-align:center">${item.quantity}</td><td style="padding:12px 0;border-bottom:1px solid #4A4A4A;text-align:right">${money(item.lineTotal, data.currency)}</td></tr>`;
  }).join("");
  const body = `<p style="color:#B0B0B0;line-height:1.6">You left something in your bag. It's printed one at a time in New York — still here whenever you're ready.</p><table style="width:100%;border-collapse:collapse;margin-top:24px;color:#FAFAFA"><tbody>${rows}<tr><td colspan="2" style="padding-top:18px;font-weight:700">Subtotal</td><td style="padding-top:18px;text-align:right;font-weight:700">${money(data.subtotal, data.currency)}</td></tr></tbody></table><p style="margin:32px 0"><a href="${escapeHtml(data.recoverUrl)}" style="background:#FF6B6B;color:#1A1A1A;padding:16px 24px;text-decoration:none;font-weight:700">Finish checking out</a></p><p style="color:#B0B0B0;line-height:1.6">Free shipping. Secure Square checkout. Made after hours, worn all day.</p>`;
  const html = shell("Still in your bag", "You're almost wearing it", body, data.unsubscribeUrl);
  const text = ["AFTER HOURS AGENDA", "You left something in your bag — still here whenever you're ready.", ...data.items.map((i) => `${i.quantity}x ${i.title}${i.size ? ` / ${i.size}` : ""} — ${money(i.lineTotal, data.currency)}`), `Subtotal: ${money(data.subtotal, data.currency)}`, `Finish checking out: ${data.recoverUrl}`, `Unsubscribe: ${data.unsubscribeUrl}`, MAILING_ADDRESS].join("\n\n");
  return { subject, html, text };
}
