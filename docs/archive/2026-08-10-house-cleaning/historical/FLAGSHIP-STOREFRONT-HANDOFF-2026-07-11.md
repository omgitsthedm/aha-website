# AHA Flagship Storefront Handoff

Date: 2026-07-11
Branch: `feature/flagship-storefront-20260711`
Base: `f57ce6b`
Production changed: no

## Objective

Evolve the live storefront into a more complete flagship brand and commerce experience without changing Square, Printful, checkout behavior, product data, prices, inventory, Netlify settings, or production state.

## Design Direction

- Archetype: DTC ecommerce first, brand/editorial second.
- Audience: design-conscious shoppers looking for independent New York streetwear.
- Language: nocturnal, graphic, square-edged, black-sheep editorial.
- Dials: variance 8, motion 6, density 5.
- Preserved: AHA pink, dark ink/paper palette, Arial Black and IBM Plex Mono, square geometry, campaign mosaic, black-sheep marks, honest made-to-order language.

## Completed

- Rebuilt the homepage around distinct conversion and storytelling jobs instead of repeated section templates.
- Tightened the hero to one clear promise, two direct shopping routes, and visible shipping/return expectations.
- Added a five-product current rotation when the New Arrivals collection is empty, without implying false recency or popularity.
- Reworked product discovery into an asymmetric featured edit plus a six-piece design index.
- Expanded first-party campaign imagery into a four-image editorial sequence.
- Rebuilt collection discovery around one Black Sheep spotlight and a compact route index.
- Expanded the About page with the black-sheep story, collection ideas, and transparent production information.
- Expanded the Lookbook with a complete campaign composition and direct shopping route.
- Added `OnlineStore` and `WebSite` structured data plus a default Open Graph image and mobile theme color.
- Added one purposeful page-entry motion sequence with a complete reduced-motion fallback.
- Added below-fold `content-visibility` containment and a smaller WebP hero source.
- Hardened add-to-bag feedback timer cleanup and normalized visible product-detail dash typography without changing protected product data.
- Added an inverse `RouteBadge` state for accessible contrast on the AHA pink collection spotlight.

## Commerce Boundaries Preserved

- No checkout, Square, Printful, pricing, mapping, inventory, order, customer, fulfillment, DNS, Netlify, secret, or production data behavior changed.
- `data/product-manifest.json`, `.env*`, and live provider settings were not modified or inspected.
- No live checkout, payment, order, fulfillment, push, merge, or deploy occurred.

## Validation

- TypeScript: pass.
- ESLint with zero warnings: pass.
- Vitest: 21/21 pass.
- Product validation: 100 active products pass.
- Square mapping: pass for every active variant.
- Printful v2 mapping: pass for every active variant.
- Margin policy: no active variant below the 35% product-cost margin floor.
- Production build: pass, 28 static/dynamic route entries generated.
- Playwright smoke: 4/4 pass across Desktop Chrome and iPhone 13 profiles.
- Manual mobile browser flow: product image and size selection, add-to-bag state, focus-managed confirmation dialog, cart drawer, bag page, totals, shipping/tax copy, and checkout entry verified. No payment submitted.
- Lighthouse local production build: Performance 97, Accessibility 100, Best Practices 100, SEO 100. FCP 0.9s, LCP 2.6s, TBT 0ms, CLS 0.
- Baseline public guards before editing: exact Netlify target, production commerce env-name readiness, and `https://afterhoursagenda.com/` live content all passed.

## Remaining Release Work

1. Review the local branch in a Deploy Preview.
2. Repeat Lighthouse on the preview and inspect field-like mobile throttling; local LCP was 2.6s, 0.1s above the preferred 2.5s ceiling.
3. Run manual Safari and VoiceOver checks on the preview.
4. Keep the Square webhook URL/signature alignment caveat separate from this visual release.
5. Merge and deploy only after David explicitly approves the scoped release.

## Next Action

Create a reviewed Deploy Preview from `feature/flagship-storefront-20260711`; do not merge to `main` or deploy production automatically.
