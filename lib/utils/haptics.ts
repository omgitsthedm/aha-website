/**
 * One subtle tap for tactile confirmations (add to bag). Works on Android
 * Chrome and, as of Safari 26, in installed iOS web apps. Silently a no-op
 * everywhere else. Never used for attention-getting — confirmations only.
 */
export function hapticTap() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  } catch {
    // never let a haptic break a purchase
  }
}
