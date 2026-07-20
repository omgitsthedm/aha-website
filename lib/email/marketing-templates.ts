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
  const body = `<p style="color:#B0B0B0;line-height:1.6">You left something made to order in your bag. It is still here whenever you're ready.</p><table style="width:100%;border-collapse:collapse;margin-top:24px;color:#FAFAFA"><tbody>${rows}<tr><td colspan="2" style="padding-top:18px;font-weight:700">Subtotal</td><td style="padding-top:18px;text-align:right;font-weight:700">${money(data.subtotal, data.currency)}</td></tr></tbody></table><p style="margin:32px 0"><a href="${escapeHtml(data.recoverUrl)}" style="background:#FF6B6B;color:#1A1A1A;padding:16px 24px;text-decoration:none;font-weight:700">Finish checking out</a></p><p style="color:#B0B0B0;line-height:1.6">Free shipping. Secure Square checkout. Made after hours, worn all day.</p>`;
  const html = shell("Still in your bag", "You're almost wearing it", body, data.unsubscribeUrl);
  const text = ["AFTER HOURS AGENDA", "You left something in your bag — still here whenever you're ready.", ...data.items.map((i) => `${i.quantity}x ${i.title}${i.size ? ` / ${i.size}` : ""} — ${money(i.lineTotal, data.currency)}`), `Subtotal: ${money(data.subtotal, data.currency)}`, `Finish checking out: ${data.recoverUrl}`, `Unsubscribe: ${data.unsubscribeUrl}`, MAILING_ADDRESS].join("\n\n");
  return { subject, html, text };
}

export function renderWelcomeEmail(data: { shopUrl: string; unsubscribeUrl: string }): { subject: string; html: string; text: string } {
  const subject = "Welcome to After Hours Agenda";
  const body = `<p style="color:#B0B0B0;line-height:1.6">You're on the list. After Hours Agenda is independent streetwear from New York — the name is literal. Designs get drawn when the day quiets down, then printed one at a time when you order. Nothing sits in a warehouse waiting to be discounted.</p><p style="color:#B0B0B0;line-height:1.6">You'll hear from us when a new release drops — and not much otherwise.</p><p style="margin:32px 0"><a href="${escapeHtml(data.shopUrl)}" style="background:#FF6B6B;color:#1A1A1A;padding:16px 24px;text-decoration:none;font-weight:700">Start with the new arrivals</a></p>`;
  const html = shell("The list", "Welcome to the after hours", body, data.unsubscribeUrl);
  const text = ["AFTER HOURS AGENDA", "You're on the list. Independent NYC streetwear, printed one at a time when you order.", "You'll hear from us when a new release drops — and not much otherwise.", `Shop new arrivals: ${data.shopUrl}`, `Unsubscribe: ${data.unsubscribeUrl}`, MAILING_ADDRESS].join("\n\n");
  return { subject, html, text };
}

export function renderWinbackEmail(data: { shopUrl: string; unsubscribeUrl: string }): { subject: string; html: string; text: string } {
  const subject = "Something new, drawn after hours";
  const body = `<p style="color:#B0B0B0;line-height:1.6">It's been a minute. We've kept drawing after the day goes quiet - new graphics, same made-to-order production.</p><p style="color:#B0B0B0;line-height:1.6">Come see what's new. Nothing sits in a warehouse waiting to be discounted - but the fits still stack.</p><p style="margin:32px 0"><a href="${escapeHtml(data.shopUrl)}" style="background:#FF6B6B;color:#1A1A1A;padding:16px 24px;text-decoration:none;font-weight:700">See what's new</a></p>`;
  const html = shell("Come back", "We've been busy after hours", body, data.unsubscribeUrl);
  const text = ["AFTER HOURS AGENDA", "It's been a minute - new graphics, same made-to-order production.", `See what's new: ${data.shopUrl}`, `Unsubscribe: ${data.unsubscribeUrl}`, MAILING_ADDRESS].join("\n\n");
  return { subject, html, text };
}

export function renderReviewRequestEmail(data: {
  orderNumber: string; items: Array<{ title: string; slug?: string | null }>; reviewUrl: string; unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "How's it wearing?";
  const list = data.items.map((i) => `<li style="margin:6px 0">${escapeHtml(i.title)}</li>`).join("");
  const body = `<p style="color:#B0B0B0;line-height:1.6">Your order (${escapeHtml(data.orderNumber)}) should be with you by now. If it's earned a spot in the rotation, a few words help the next person decide — and it means a lot to a small shop.</p><ul style="color:#FAFAFA;padding-left:18px">${list}</ul><p style="margin:32px 0"><a href="${escapeHtml(data.reviewUrl)}" style="background:#FF6B6B;color:#1A1A1A;padding:16px 24px;text-decoration:none;font-weight:700">Leave a review</a></p>`;
  const html = shell("Worn, not just shown", "How's it wearing?", body, data.unsubscribeUrl);
  const text = ["AFTER HOURS AGENDA", `Your order ${data.orderNumber} should be with you by now.`, "If it earned a spot in the rotation, a few words help the next person decide.", ...data.items.map((i) => `- ${i.title}`), `Leave a review: ${data.reviewUrl}`, `Unsubscribe: ${data.unsubscribeUrl}`, MAILING_ADDRESS].join("\n\n");
  return { subject, html, text };
}
