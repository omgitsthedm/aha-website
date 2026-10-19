// The checkout side of early access (see server/catalog/drops.mjs): which
// variations this request can't buy yet. Asks the database only while a drop
// is pending, and treats a failed lookup as signed out.
import { lockedVariations, pendingDrops, DROPS } from "../catalog/drops.mjs";
import { accountFor } from "./auth.mjs";

export async function earlyAccessLocks(request, products, { db, now = Date.now(), drops = DROPS } = {}) {
  if (!pendingDrops(now, drops).length) return new Set();
  const signedIn = Boolean(await Promise.resolve().then(() => accountFor(request, db())).catch(() => null));
  return lockedVariations(products, { now, signedIn, drops });
}
