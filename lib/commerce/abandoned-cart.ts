import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { abandonedCarts, orders } from "@/db/schema";
import { renderAbandonedCartEmail, type AbandonedCartLine } from "@/lib/email/marketing-templates";
import { isMarketingEmailConfigured, isLifecycleEmailEnabled, sendMarketingEmail, unsubscribeUrl, recoverCartUrl } from "@/lib/email/marketing";

// Don't nag instantly, and don't chase stale carts forever.
const MIN_AGE_MS = 60 * 60 * 1000;        // wait 1h after last activity before recovering
const MAX_AGE_MS = 72 * 60 * 60 * 1000;   // give up after 3 days

export interface CaptureLine {
  title: string; size?: string | null; quantity: number; lineTotal: number; slug?: string;
  // Fields needed to rebuild the bag on any device from the recovery link.
  variationId?: string; productId?: string; price?: number; priceFormatted?: string; image?: string;
}

const validEmail = (email: string) => /.+@.+\..+/.test(email);

/**
 * Upsert one open abandoned cart per email. Called non-blocking from checkout —
 * every path swallows errors so it can NEVER affect the purchase flow.
 */
export async function captureAbandonedCart(input: {
  email: string; items: CaptureLine[]; subtotal: number; currency?: string;
}): Promise<void> {
  if (!isDbConfigured()) return;
  const email = input.email.trim().toLowerCase();
  if (!validEmail(email) || input.items.length === 0) return;
  try {
    await db().insert(abandonedCarts).values({
      email,
      itemsJson: input.items,
      subtotal: input.subtotal,
      currency: input.currency || "USD",
    }).onConflictDoUpdate({
      target: abandonedCarts.email,
      // Refresh the bag + activity time; never resurrect a recovered/notified row.
      set: { itemsJson: input.items, subtotal: input.subtotal, currency: input.currency || "USD", updatedAt: new Date() },
    });
  } catch { /* capture is best-effort — never surface to checkout */ }
}

/** Returns the saved bag lines for a verified email, for cross-device restore. */
export async function getSavedCart(email: string): Promise<CaptureLine[]> {
  if (!isDbConfigured()) return [];
  try {
    const [row] = await db().select({ items: abandonedCarts.itemsJson, unsubscribed: abandonedCarts.unsubscribed })
      .from(abandonedCarts).where(eq(abandonedCarts.email, email.trim().toLowerCase())).limit(1);
    if (!row) return [];
    return Array.isArray(row.items) ? (row.items as CaptureLine[]) : [];
  } catch { return []; }
}

/** Global suppression: upsert so unsubscribe is recorded even for someone who
 * never had an abandoned cart (e.g. unsubscribing from a review email). This
 * row doubles as the suppression list for all lifecycle email. */
export async function unsubscribeEmail(email: string): Promise<void> {
  if (!isDbConfigured()) return;
  const e = email.trim().toLowerCase();
  try {
    await db().insert(abandonedCarts)
      .values({ email: e, itemsJson: [], subtotal: 0, unsubscribed: true })
      .onConflictDoUpdate({ target: abandonedCarts.email, set: { unsubscribed: true, updatedAt: new Date() } });
  } catch { /* best-effort */ }
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const [row] = await db().select({ u: abandonedCarts.unsubscribed })
      .from(abandonedCarts).where(eq(abandonedCarts.email, email.trim().toLowerCase())).limit(1);
    return Boolean(row?.u);
  } catch { return false; }
}

interface DispatchResult { configured: boolean; enabled: boolean; candidates: number; sent: number; suppressed: number; dryRun: number }

/**
 * Scan due carts and send ONE recovery email each. Suppresses carts where an
 * order already exists for that email. When the lifecycle gate is OFF, runs a
 * dry-run (counts what it WOULD send, sends nothing, leaves notifiedAt unset).
 */
export async function dispatchAbandonedCarts(limit = 25): Promise<DispatchResult> {
  const result: DispatchResult = { configured: false, enabled: false, candidates: 0, sent: 0, suppressed: 0, dryRun: 0 };
  if (!isDbConfigured() || !isMarketingEmailConfigured()) return result;
  result.configured = true;
  result.enabled = isLifecycleEmailEnabled();

  const now = Date.now();
  const notBefore = new Date(now - MAX_AGE_MS); // updatedAt must be newer than this
  const notAfter = new Date(now - MIN_AGE_MS);  // ...and older than this

  const candidates = await db().select().from(abandonedCarts).where(and(
    isNull(abandonedCarts.notifiedAt),
    isNull(abandonedCarts.recoveredAt),
    eq(abandonedCarts.unsubscribed, false),
    gte(abandonedCarts.updatedAt, notBefore),
    lte(abandonedCarts.updatedAt, notAfter),
  )).limit(limit);
  result.candidates = candidates.length;

  for (const cart of candidates) {
    // Suppress if they already ordered after starting this cart.
    const [ordered] = await db().select({ id: orders.id }).from(orders)
      .where(and(eq(orders.email, cart.email), gte(orders.createdAt, cart.createdAt)))
      .limit(1);
    if (ordered) {
      await db().update(abandonedCarts).set({ recoveredAt: new Date(), updatedAt: new Date() }).where(eq(abandonedCarts.id, cart.id));
      result.suppressed += 1;
      continue;
    }

    if (!result.enabled) { result.dryRun += 1; continue; } // gate OFF → count only

    const lines = (Array.isArray(cart.itemsJson) ? cart.itemsJson : []) as AbandonedCartLine[];
    if (lines.length === 0) continue;
    const rendered = renderAbandonedCartEmail({
      items: lines, subtotal: cart.subtotal, currency: cart.currency,
      recoverUrl: recoverCartUrl(cart.email),
      unsubscribeUrl: unsubscribeUrl(cart.email),
    });
    try {
      await sendMarketingEmail({ idempotencyKey: `abandoned:${cart.id}`, to: cart.email, stream: "abandoned_cart", ...rendered });
      await db().update(abandonedCarts).set({ notifiedAt: new Date(), updatedAt: new Date() }).where(eq(abandonedCarts.id, cart.id));
      result.sent += 1;
    } catch {
      // leave notifiedAt null so the next run retries
    }
  }
  return result;
}

/** Sends a sample recovery email to a chosen address regardless of the gate — for a safe pre-launch test. */
export async function sendAbandonedCartTest(to: string): Promise<string> {
  const rendered = renderAbandonedCartEmail({
    items: [{ title: "No Kings — White Short Sleeve T-shirt", size: "M", quantity: 1, lineTotal: 3400 }],
    subtotal: 3400, currency: "USD",
    recoverUrl: recoverCartUrl(to),
    unsubscribeUrl: unsubscribeUrl(to),
  });
  return sendMarketingEmail({ idempotencyKey: `abandoned-test:${Date.now()}`, to, stream: "abandoned_cart_test", ...rendered });
}
