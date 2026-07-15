import { eq, isNull, lt, sql } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { orders, winbackLog } from "@/db/schema";
import { renderWinbackEmail } from "@/lib/email/marketing-templates";
import { isMarketingEmailConfigured, isLifecycleEmailEnabled, sendMarketingEmail, unsubscribeUrl, siteOrigin } from "@/lib/email/marketing";
import { isEmailSuppressed } from "@/lib/commerce/abandoned-cart";

// Re-engage a buyer whose most recent order is older than this and who hasn't
// ordered since. One email per email address, ever (conservative).
const LAPSED_MS = 60 * 24 * 60 * 60 * 1000;

interface WinbackResult { configured: boolean; enabled: boolean; candidates: number; sent: number; dryRun: number; skipped: number }

export async function dispatchWinback(limit = 25): Promise<WinbackResult> {
  const result: WinbackResult = { configured: false, enabled: false, candidates: 0, sent: 0, dryRun: 0, skipped: 0 };
  if (!isDbConfigured() || !isMarketingEmailConfigured()) return result;
  result.configured = true;
  result.enabled = isLifecycleEmailEnabled();
  const cutoff = new Date(Date.now() - LAPSED_MS);

  // Emails whose LATEST order is older than the cutoff, not already win-backed.
  const rows = await db()
    .select({ email: orders.email, lastOrder: sql<string>`max(${orders.createdAt})` })
    .from(orders)
    .leftJoin(winbackLog, eq(winbackLog.email, orders.email))
    .where(isNull(winbackLog.id))
    .groupBy(orders.email)
    .having(lt(sql`max(${orders.createdAt})`, cutoff))
    .limit(limit);
  result.candidates = rows.length;
  if (rows.length === 0) return result;

  for (const row of rows) {
    if (!row.email) { result.skipped += 1; continue; }
    if (await isEmailSuppressed(row.email)) { result.skipped += 1; continue; }
    if (!result.enabled) { result.dryRun += 1; continue; }
    const rendered = renderWinbackEmail({ shopUrl: `${siteOrigin()}/new-arrivals`, unsubscribeUrl: unsubscribeUrl(row.email) });
    try {
      await sendMarketingEmail({ idempotencyKey: `winback:${row.email}`, to: row.email, stream: "winback", ...rendered });
      await db().insert(winbackLog).values({ email: row.email }).onConflictDoNothing();
      result.sent += 1;
    } catch { /* retry next run */ }
  }
  return result;
}
