# After Hours Agenda — Frictionless Commerce Plan

> **Prime directive:** *Find → Buy → Done.* Every screen either removes a wall or it gets cut.
> Someone should be able to see something and own it in the fewest taps physically possible.
> Owner: David · info@afterhoursagenda.com · Created 2026-07-14

This merges (a) the platform gap map and (b) what we borrow from Shopify —
the best-converting checkout on the internet — adapted to our stack
(**Square** payments, **Printful** fulfillment, **Next.js 15**, **Resend** email).
We do not run on Shopify, so we borrow the *principles*, not the product, and aim to beat it on taste and honesty.

---

## 1. Why Shopify converts best (researched, 2025–2026)

| Lever | The number | The mechanic |
|---|---|---|
| **Shop Pay (one-tap)** | up to **+50%** vs guest checkout; beats other express by **≥10%** | An *identity network* — remembers 150M+ buyers' shipping + payment, so returning buyers pay in one tap with zero re-entry. This network effect is the real moat. |
| **Shopify Checkout overall** | up to **+36%** (avg **+15%**) vs other platforms | One-page checkout, address autofill, minimal required fields, fixed fast layout. |
| **Speed** | — | Global CDN + prefetch; checkout loads instantly. Every 100ms of latency costs conversion. |
| **Express buttons on PDP/cart** | — | Apple/Google/Shop Pay *above the fold*, not just at checkout. |
| **Dynamic "Buy it now"** | mixed — sometimes **−11%** vs add-to-cart | Skips the cart from the PDP. **Offer as an option + A/B — do not blindly replace add-to-bag.** |
| **Predictive search** | — | Instant results as you type; no results page round-trip. |
| **Built-in recommendations** | — | "You may also like" / complete-the-look raises AOV automatically. |

**The through-line:** Shopify wins by *removing decisions and re-entry*, being *fast*, and
*recognizing the returning buyer*. That's exactly what we can replicate on Square.

---

## 2. What we borrow (and how, on Square)

We already have: one-page `/checkout` (contact + shipping + payment on one screen),
Apple Pay + Google Pay wired and domain-verified, sticky mobile add-to-bag, a product feed.
The gaps below are the borrow list.

1. **Express wallets above the fold** — surface Apple/Google Pay on the **PDP** and **cart**, not only at checkout. Returning-intent buyers skip three screens.
2. **"Buy it now" fast path** — optional button on PDP → straight to `/checkout` with that one item (A/B against add-to-bag; keep both).
3. **Address autocomplete** — Google Places (or equivalent) to collapse 5 address fields into 1 typed line. Biggest single friction cut in checkout.
4. **Returning-buyer recognition** — email-keyed prefill of name/shipping from prior order (our honesty-safe version of the identity network; no forced account).
5. **Predictive/instant search** — overlay with live results + product thumbnails as you type (we have `/api/search-index`; make it instant).
6. **Product recommendations** — "You may also like" + "Complete the look" on PDP and cart. New engine (we have `recommend: 0` today).
7. **Fewer required fields** — smart defaults (country, formatting), defer optional fields, no field that Square/Printful doesn't require.
8. **One-tap reorder** — from order-confirmation + track-order + email.
9. **Persistent cart** — survives across sessions/devices (email-linked), so "come back and buy" has no wall.
10. **Speed budget** — keep Lighthouse ≥90, prefetch PDP + checkout, lazy everything below the fold.

---

## 3. Where we beat Shopify

- **Honesty by default** — no fake scarcity, no forced accounts, no dark patterns. Reject is as loud as Accept. (Shopify stores routinely violate this; we won't.)
- **Taste** — Origami/editorial brand system + real motion + lifestyle campaign layer. Most Shopify themes are templated; ours is bespoke.
- **Made-to-order transparency** — "printed one at a time when you order" is a *feature*, told honestly, not hidden.
- **One brand, one voice** — copy, PDP storytelling, and email all speak in the AHA voice, not app-store defaults.

---

## 4. Build backlog — merged gap map + Shopify borrows

Ordered by ROI. Each wave ships independently and is verified live on mobile + desktop.

### Wave 1 — Friction kills (find → buy → done)  ← START HERE
- [ ] **Express wallets on PDP + cart** (Apple/Google Pay above the fold)
- [ ] **"Buy it now" fast path** on PDP (skip cart, A/B vs add-to-bag)
- [ ] **Address autocomplete** in checkout (collapse address to one line)
- [ ] **Instant predictive search** overlay with thumbnails
- [ ] **Product recommendations** — "You may also like" + "Complete the look" (PDP + cart)

### Wave 2 — Revenue engines (work regardless of placeholder vs real products)
- [ ] **Abandoned-cart email** (Resend) — recover 5–15% of lost checkouts
- [ ] **Welcome series** (newsletter → first-order nudge)
- [ ] **Post-purchase flow** → thank-you + **review request** (feeds the review component)
- [ ] **Win-back** flow for lapsed buyers
- [ ] **One-tap reorder** + **persistent/email-linked cart**

### Wave 3 — Merchandising depth
- [ ] **Gift cards** (Square-native) — new revenue + gifting
- [ ] **Real wishlist / save-for-later** (only a tracking event exists today)
- [ ] **Bundles / "the fit"** builder (beyond the BOGO "OneOnMe" code)
- [ ] **Back-in-stock / drop-notify** (wire the `/restock` stub)
- [ ] **Optional accounts** (order history + saved address) — never forced

### Wave 4 — Content-truth swap (as real products + photos land)
- [ ] Real PDP copy, real photography incl. **back-views** (needs curation — not automatable)
- [ ] Real size/fit per garment, real care, real drop calendar + made-to-order language
- [ ] Fill stub pages with truthful content: `returns`, `shipping`, `size-guide`, `restock`, `best-sellers`
- [ ] Replace placeholder AI lifestyle set with real campaign shots (slots already built)

### Wave 5 — Growth wiring (gated on David's account IDs / dashboard toggles)
- [ ] GA4 / Meta / TikTok pixels (need IDs) → consent-gated, already scaffolded
- [ ] **Cash App Pay + Afterpay** (Square dashboard toggles → we wire) — see checklist §6
- [ ] Merchant Center feed connect, Meta Shop, TikTok Shop (Printful channels)
- [ ] `/shop` search relevance + filters/sort verification
- [ ] Structured-data completeness + ops analytics view for David

---

## 5. Guardrails (non-negotiable)

- Never break **Cart → Checkout → Payment → Confirmation**.
- No fake urgency/scarcity/reviews, no hidden fees, **no forced account before checkout**.
- PDP main/gallery stay **truthful** (real product), even while lifestyle imagery is staged.
- Express/buy-now are **additive options**, never the only path (A/B, respect the data).
- Accessibility + mobile-first + reduced-motion are part of "done."

## 6. Human dependencies (only things AI physically cannot do)
Tracked in `~/Desktop/AFTER-HOURS-AGENDA-PLATFORM-WIRING-CHECKLIST.md`:
GA4/Meta/TikTok IDs, Square dashboard toggles (Cash App Pay, Afterpay), Merchant Center /
Meta Shop / TikTok Shop connections, real product photography (incl. back-views).
