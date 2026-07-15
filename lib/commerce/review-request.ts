import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { orders, orderItems, shipments, reviewRequestLog } from "@/db/schema";
import { getAllProducts } from "@/lib/square/catalog";
import { renderReviewRequestEmail } from "@/lib/email/marketing-templates";
import { isMarketingEmailConfigured, isLifecycleEmailEnabled, sendMarketingEmail, unsubscribeUrl, siteOrigin } from "@/lib/email/marketing";
import { isEmailSuppressed } from "@/lib/commerce/abandoned-cart";

// Ask a week after it ships — enough time to actually wear it.
const REVIEW_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

interface ReviewDispatchResult { configured: boolean; enabled: boolean; candidates: number; sent: number; dryRun: number; skipped: number }

/**
 * One post-purchase review request per shipped order, 7+ days after shipment.
 * Deduped via review_request_log (written only on a real send). Honors the
 * lifecycle gate (dry-run when off) and the unsubscribe list.
 */
export async function dispatchReviewRequests(limit = 25): Promise<ReviewDispatchResult> {
  const result: ReviewDispatchResult = { configured: false, enabled: false, candidates: 0, sent: 0, dryRun: 0, skipped: 0 };
  if (!isDbConfigured() || !isMarketingEmailConfigured()) return result;
  result.configured = true;
  result.enabled = isLifecycleEmailEnabled();
  const cutoff = new Date(Date.now() - REVIEW_DELAY_MS);

  const rows = await db()
    .select({ orderId: shipments.orderId })
    .from(shipments)
    .leftJoin(reviewRequestLog, eq(reviewRequestLog.orderId, shipments.orderId))
    .where(and(isNotNull(shipments.shippedAt), lte(shipments.shippedAt, cutoff), isNull(reviewRequestLog.id)))
    .limit(limit);
  result.candidates = rows.length;
  if (rows.length === 0) return result;

  const products = await getAllProducts().catch(() => []);
  const byId = new Map(products.map((p) => [p.id, p.slug]));
  const byName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p.slug]));
  const resolveSlug = (i: { ahaProductId: string; titleSnapshot: string }) =>
    byId.get(i.ahaProductId) || byName.get(i.titleSnapshot.trim().toLowerCase()) || null;

  for (const row of rows) {
    if (!row.orderId) continue;
    const [order] = await db().select().from(orders).where(eq(orders.id, row.orderId)).limit(1);
    if (!order?.email) { result.skipped += 1; continue; }
    if (await isEmailSuppressed(order.email)) { result.skipped += 1; continue; }
    const items = await db().select().from(orderItems).where(eq(orderItems.orderId, row.orderId));
    if (items.length === 0) { result.skipped += 1; continue; }

    if (!result.enabled) { result.dryRun += 1; continue; }

    const firstSlug = items.map(resolveSlug).find(Boolean) || null;
    const reviewUrl = firstSlug ? `${siteOrigin()}/product/${firstSlug}#reviews` : `${siteOrigin()}/shop`;
    const rendered = renderReviewRequestEmail({
      orderNumber: order.externalOrderNumber,
      items: items.map((i) => ({ title: i.titleSnapshot, slug: resolveSlug(i) })),
      reviewUrl, unsubscribeUrl: unsubscribeUrl(order.email),
    });
    try {
      await sendMarketingEmail({ idempotencyKey: `review:${row.orderId}`, to: order.email, stream: "review_request", ...rendered });
      await db().insert(reviewRequestLog).values({ orderId: row.orderId }).onConflictDoNothing();
      result.sent += 1;
    } catch {
      /* leave unlogged → retried next run */
    }
  }
  return result;
}
