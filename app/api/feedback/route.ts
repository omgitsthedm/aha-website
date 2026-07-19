import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sendTransactionalEmail, isTransactionalEmailConfigured } from "@/lib/email/resend";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const esc = (s: unknown) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
const FEEDBACK_TO = process.env.FEEDBACK_EMAIL || process.env.ORDER_SUPPORT_EMAIL || "info@afterhoursagenda.com";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  // Honeypot: real users never fill this hidden field. Accept silently so bots
  // get a success and don't retry, but send nothing.
  if (typeof body?.hp === "string" && body.hp.trim() !== "") return NextResponse.json({ ok: true });

  // Rate limit: this endpoint emails the ops inbox on every send.
  const limit = rateLimit(`feedback:${clientIp(req)}`, 5, 60_000);
  if (!limit.ok) return NextResponse.json({ ok: false, error: "Too many messages. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 4000) : "";
  if (!message) return NextResponse.json({ ok: false, error: "Empty feedback." }, { status: 400 });
  if (!isTransactionalEmailConfigured()) return NextResponse.json({ ok: false, error: "Email not configured." }, { status: 503 });

  const currentPath = typeof body?.currentPath === "string" ? body.currentPath.slice(0, 300) : "";
  const rawHistory: unknown[] = Array.isArray(body?.history) ? body.history.slice(-60) : [];
  const history: Array<{ path: string; at: string }> = rawHistory
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
    .map((v) => ({ path: String(v.path ?? "").slice(0, 300), at: String(v.at ?? "").slice(0, 40) }));
  const meta = (body?.meta && typeof body.meta === "object" ? body.meta : {}) as Record<string, unknown>;

  const journey = history.length
    ? history.map((v, i) => `${i + 1}. ${v.path}${v.at ? `  (${v.at})` : ""}`).join("\n")
    : "(no path recorded)";

  const text = [
    "AFTER HOURS AGENDA — site feedback",
    "",
    "MESSAGE:",
    message,
    "",
    `CURRENT PAGE: ${meta.url || currentPath}`,
    "",
    "PATH THIS SESSION:",
    journey,
    "",
    "CONTEXT:",
    `Viewport: ${meta.viewport || "?"}`,
    `Referrer: ${meta.referrer || "(direct)"}`,
    `When: ${meta.at || ""}`,
    `Browser: ${meta.userAgent || "?"}`,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#1A1A1A;color:#FAFAFA;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:32px 24px"><div style="height:6px;background:linear-gradient(90deg,#FF6B6B 0 25%,#87CEEB 25% 50%,#A8D5BA 50% 75%,#F0C987 75%)"></div><p style="color:#FF6B6B;font-size:12px;font-weight:700;letter-spacing:.08em">After Hours Agenda / Site feedback</p><div style="background:#242424;border-left:3px solid #FF6B6B;padding:14px 16px;margin:16px 0;white-space:pre-wrap;line-height:1.5">${esc(message)}</div><table style="width:100%;color:#B0B0B0;font-size:13px;line-height:1.6"><tr><td style="padding:4px 0"><strong style="color:#FAFAFA">Current page</strong></td><td><a href="${esc(meta.url || currentPath)}" style="color:#87CEEB">${esc(meta.url || currentPath)}</a></td></tr><tr><td style="padding:4px 0"><strong style="color:#FAFAFA">Viewport</strong></td><td>${esc(meta.viewport)}</td></tr><tr><td style="padding:4px 0"><strong style="color:#FAFAFA">Referrer</strong></td><td>${esc(meta.referrer) || "(direct)"}</td></tr><tr><td style="padding:4px 0"><strong style="color:#FAFAFA">When</strong></td><td>${esc(meta.at)}</td></tr><tr><td style="padding:4px 0;vertical-align:top"><strong style="color:#FAFAFA">Browser</strong></td><td>${esc(meta.userAgent)}</td></tr></table><p style="color:#FAFAFA;font-weight:700;margin-top:20px">Path this session</p><ol style="color:#B0B0B0;font-size:13px;line-height:1.7;padding-left:20px">${history.map((v) => `<li>${esc(v.path)}${v.at ? ` <span style="color:#777">(${esc(v.at)})</span>` : ""}</li>`).join("") || "<li>(no path recorded)</li>"}</ol></div></body></html>`;

  try {
    await sendTransactionalEmail({
      idempotencyKey: `feedback-${randomUUID()}`,
      to: FEEDBACK_TO,
      subject: `Site feedback — ${currentPath || "afterhoursagenda.com"}`,
      html,
      text,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Feedback send failed:", error);
    return NextResponse.json({ ok: false, error: "Couldn't send. Try again." }, { status: 502 });
  }
}
