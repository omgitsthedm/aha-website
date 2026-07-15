import { NextResponse } from "next/server";
import { db, isDbConfigured } from "@/lib/db/client";
import { emailSubscribers } from "@/db/schema";
import { renderWelcomeEmail } from "@/lib/email/marketing-templates";
import { isMarketingEmailConfigured, isLifecycleEmailEnabled, sendMarketingEmail, unsubscribeUrl, siteOrigin } from "@/lib/email/marketing";

// Called by the Netlify Forms submission-created function when someone joins the
// list. Records the subscriber and sends ONE welcome (gated). Secret-gated.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.get("authorization") || "";
  return h === `Bearer ${secret}` || h === secret;
}

export async function POST(req: Request) {
  if (!authorized(req)) return new NextResponse("Not found", { status: 404 });
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/.+@.+\..+/.test(email)) return NextResponse.json({ ok: false, error: "bad email" }, { status: 400 });

  let firstTime = true;
  if (isDbConfigured()) {
    try {
      const inserted = await db().insert(emailSubscribers)
        .values({ email, source: "newsletter" })
        .onConflictDoNothing()
        .returning({ id: emailSubscribers.id });
      firstTime = inserted.length > 0; // welcome only on the first subscribe
    } catch { /* non-fatal */ }
  }

  let welcomed = false;
  if (firstTime && isMarketingEmailConfigured() && isLifecycleEmailEnabled()) {
    try {
      const rendered = renderWelcomeEmail({ shopUrl: `${siteOrigin()}/new-arrivals`, unsubscribeUrl: unsubscribeUrl(email) });
      await sendMarketingEmail({ idempotencyKey: `welcome:${email}`, to: email, stream: "welcome", ...rendered });
      welcomed = true;
    } catch { /* non-fatal */ }
  }
  return NextResponse.json({ ok: true, firstTime, welcomed });
}
