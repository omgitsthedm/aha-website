# AHA Commerce Audit

Baseline: 2026-07-10. No live order, payment, refund, product mutation, or Printful fulfillment was performed.

## Current architecture

- Square: catalog, authoritative tax/order pricing, Web Payments SDK, payment capture, refunds/order events
- Netlify DB/Neon: operational orders, items, payments, fulfillments, shipments, webhook ledger, audit log
- Printful: product/variant data, draft orders, optional confirmation behind two flags, shipment events
- Rebuilt storefront registry: 138 products, 100 profit-cleared active products, 1,323 variants, and 1,323 exact Square/Printful map entries
- Printful cost snapshot covers 1,180 variants. The profit policy quarantines 188 missing/below-floor variants and 21 products with no eligible variant; 994 active variants pass the 35% product-cost floor

## Findings

| Severity | Evidence | User/business impact | Location | Recommended action | Approval | Verification | Status |
|---|---|---|---|---|---|---|---|
| Critical | Square webhook URL differs byte-for-byte from Netlify verification URL | Reconciliation events can be rejected | Square/Netlify metadata; `app/api/webhooks/square/route.ts` | Align one non-redirecting URL on both sides | Live approval required | Signature fixture plus read-only metadata | Open |
| Critical | Square production token has Locations/Catalog access but Orders API calculate/search return 403 | On-brand checkout cannot reach authoritative tax/order pricing | `npm run verify:commerce-capabilities:netlify` | Grant required Orders permissions or replace the scoped credential | Live credential approval required | Safe calculate probe returns 200 | Open |
| Critical | Baseline browser showed subtotal while backend could charge the tax-inclusive Square total | Surprise charge and trust/legal risk | `CheckoutForm.tsx`; `create-payment/route.ts`; `app/api/checkout-quote/route.ts` | Keep quote and payment order shapes identical; reject quote drift | Local code allowed; transaction test gated | Unit/build passed; taxed sandbox transaction still required | Fixed locally, not deployed |
| High | Baseline multi-store fulfillment collapsed Printful IDs into one field | Mixed-store shipments/holds could miss reconciliation | `lib/commerce/fulfillment.ts`; `lib/commerce/webhooks.ts`; DB migration | Persist one fulfillment per order/store and aggregate status | No for local schema/code; deploy gated | Multi-store state fixtures pass; DB integration pending | Fixed locally, not deployed |
| High | Baseline webhook handlers returned 2xx without durable processing outcome | Failed reconciliation could be silently lost | Both webhook routes; `lib/commerce/webhooks.ts` | Persist processed/failed outcome, retry count, and last error | No for local code | Signature/failure unit fixtures pass; DB integration pending | Fixed locally, not deployed |
| High | No verified Manual/API Printful store exists; the previously recorded `697873` is not accessible as that store and v2 returned the Square-store set | A live product-creation attempt could orphan or duplicate provider records | `data/provider-registry.json`; `scripts/create-product.mjs` | Keep live creation blocked until a Manual/API store and direct provider-ID registry write are verified | Remote mutation tests gated | Preflight must prove store type/access without writes | Blocked safely |
| High | 188 variants fail verified-cost or 35% product-cost margin policy; 21 products have no eligible variant | Selling them would be knowingly unprofitable before fees/shipping | cost snapshot; `enforce-margin-policy.ts`; `margin-check.ts` | Keep quarantined; approve price/product decisions separately | Pricing changes gated | `npm run validate:all` passes for 994 eligible variants | Mitigated locally |
| Medium | Fulfillment mode and confirmation flags express overlapping policies | Operators may misread `manual` as no draft creation | `netlify.toml`; `lib/commerce/fulfillment.ts`; readiness warnings | Define exact mode semantics and tests | Production flag changes gated | Mode matrix tests | Open |
| Critical | Legacy `/api/checkout` created Square Payment Links outside the AHA order/fulfillment ledger | A paid order could bypass durable records and fulfillment | `app/api/checkout/route.ts` | Retire with explicit 410 and one canonical checkout path | No for local code; deploy gated | Unit test and route smoke | Fixed locally, not deployed |

## Yikes recovery truth

- Square item `Yikes` exists with six variants (S–3XL) at USD 20.99.
- The baseline manifest marked `yikes` active with six variants and claimed Printful store `697873`.
- Read-only provider checks found no Yikes sync product in the configured Printful store; stored sync-variant IDs return 404.
- The exact-ID registry rebuild does not activate Yikes. It remains blocked pending verified fulfillment mapping; no controlled live fulfillment has been run.

## Approval-gated production actions

- Webhook URL change
- Square credential/scope change
- Live or production Square checkout
- Printful draft/confirmation mutation
- Catalog/product price changes
- Enabling automatic fulfillment
