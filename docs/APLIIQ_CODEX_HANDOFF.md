# After Hours Agenda: Apliiq + Square Integration Handoff

Date: 2026-08-16
Repository: `omgitsthedm/aha-website`
Production site: `https://afterhoursagenda.com`
Netlify site: `afterhoursagenda`
Square location: `FGKRPYEXNV482` (`After Hours Agenda`)

## Mission

Keep the existing custom Next.js storefront and Square payment flow. Add Apliiq as the premium apparel fulfillment provider for the fall/winter reset without discarding historical Printful or Square order data.

The first implementation must be additive and provider-neutral. Do not replace Printful-named columns destructively, delete historical orders, or enable live Apliiq order creation during the initial code pass.

## Account readiness already completed

- Apliiq account owner: `info@afterhoursagenda.com`
- Login is stored in Apple Passwords.
- Free account only. No VIP membership or paid upgrade was purchased.
- A default fulfillment card is saved in Apliiq; saving it did not place an order or purchase VIP.
- Custom store created in Apliiq: `After Hours Agenda`
- Apliiq generated an app key and shared secret.
- Secret values are stored only in local, gitignored `.env.local` as:
  - `APLIIQ_API_KEY`
  - `APLIIQ_SHARED_SECRET`
- `.env.local` is gitignored and has `600` permissions.
- Never copy either secret into this document, source control, logs, screenshots, or client-side code.
- AHA private-label design is activated:
  - Apliiq label reference: `SB-2-155690`
  - Previous unused label `SB-1-155689` was removed after Apliiq confirmed that no products used it.
  - 10 free sewn private-label tags remain
  - Artwork: transparent black-only 300 x 300 px PNG, accepted by Apliiq as 1 x 1 inch at 300 DPI (`ideal quality`)
  - Composition: canonical black sheep, primary stacked wordmark, production border, and outlined `NYC · PRINTED TO ORDER` utility line
  - Canonical files:
    - `Brand Kit 2026-07/print-applications/apliiq-private-label-1in.png`
    - `Brand Kit 2026-07/print-applications/apliiq-private-label-1in.svg`
- Customer packing-slip note:
  - `Thank you for supporting After Hours Agenda. Made after the day job, printed to order.`
- Made-to-order product copy:
  - `This After Hours Agenda piece is made to order to reduce waste. Production typically takes about one week. We’ll email tracking as soon as it ships.`
- Shipping-label identity matches the existing Square AHA location record.
- Apliiq auto-processing is OFF for prelaunch safety.
- Out-of-stock behavior is quality-first:
  - ask AHA before substituting a blank
  - ask AHA before canceling an unavailable item
- Apliiq design profile remains private.

## Human-only open items

1. Do not purchase VIP yet. Reconsider only after verified monthly production spend makes the membership economical.
2. Do not order samples until the user approves the exact fall/winter product and artwork shortlist.

## Exhaustive Apliiq account audit (2026-08-16)

| Apliiq page | Verified status |
|---|---|
| Launch checklist | Required payment method complete; product-label branding complete; customer shipping label complete. |
| Saved designs | Empty by design until the fall/winter products are selected. |
| Approvals | Empty; no mock approval is pending. |
| Orders | Empty; no accidental test or paid order was placed. |
| Subscriptions | One active private-label design (`SB-2-155690`) with 10 free tags remaining. No inactive subscriptions. VIP, unlimited digitization, neck prints, patches, printed labels, and woven-label services were not purchased because they are optional or product-dependent. |
| Pay methods | One saved fulfillment card is present. |
| Stores | `After Hours Agenda` custom store exists and API credentials are generated. Credentials are present only in protected, gitignored local environment storage. |
| Profile | `info@afterhoursagenda.com` is set. Public design slug is intentionally blank so designs remain private. Password reset fields are intentionally blank. |
| Settings: order processing | Automatic processing is intentionally off for the prelaunch pilot. Apliiq must ask before blank substitutions and before canceling unavailable items. Branded packing-slip note is enabled. |
| Settings: product defaults | Description, benefits, features, and the AHA made-to-order message are all enabled. |
| Settings: shipping | AHA’s customer-facing shipping-label identity is configured from the existing Square business record. |
| Developer callbacks | All four fields are intentionally blank until tested production endpoints exist. This is the only non-product Apliiq-page dependency still open. |

## Callbacks intentionally left blank

Do not enter callback URLs in Apliiq until the corresponding production endpoints exist, are deployed, and pass signature tests.

Recommended endpoint layout:

- Add Product URL: `https://afterhoursagenda.com/api/integrations/apliiq/products/upsert`
- Product Search URL: `https://afterhoursagenda.com/api/integrations/apliiq/products/search?search=`
- Fulfillment URL: `https://afterhoursagenda.com/api/webhooks/apliiq/fulfillment`
- Warehouse Shipment Complete URL: leave blank until warehousing is intentionally adopted

After deployment, enter only the tested endpoints in Apliiq Stores > After Hours Agenda > callback URLs.

## Current commerce flow

Current checkout entrypoint:

- `app/api/create-payment/route.ts:37-207`
  - revalidates the cart
  - prices through Square
  - persists the internal order
  - charges Square
  - calls `startFulfillment(...)`

Order persistence:

- `lib/commerce/orders.ts:55-155,171-195`
  - snapshots provider fields onto `order_items`
  - stores Square IDs, `orders.printfulOrderId`, and separate payment/fulfillment status
  - writes payment and audit records

Fulfillment:

- `lib/commerce/fulfillment.ts:82-184`
  - groups items by `printfulStoreId`
  - claims a durable `fulfillments` row
  - creates the Printful request
  - persists the Printful order ID before confirmation

Webhook reconciliation:

- `app/api/webhooks/square/route.ts:15-93`
- `app/api/webhooks/printful/route.ts:12-78`
- `lib/commerce/webhooks.ts:53-165`

The clean provider seam is principally:

- `lib/commerce/fulfillment-state.ts:11-222`
- `lib/commerce/fulfillment.ts`

## Existing provider coupling

Schema:

- `db/schema.ts:96-145,208-230`
- `orders.printfulOrderId`
- `order_items.printfulCatalogVariantId`
- `order_items.printfulPlacementSnapshotJson`
- `order_items.printfulFileSnapshotJson`
- `fulfillments.providerStoreId` is currently an integer
- `fulfillments.printfulOrderId`
- current fulfillment uniqueness is `(orderId, providerStoreId)`
- webhook dedupe is already provider-aware

Product/runtime:

- `lib/types/product.ts:69-99`
- `lib/data/products.ts:33-46`
- `lib/commerce/fulfillment-state.ts:11-222`
- `lib/printful/size-table.ts`
- `components/product/SizeGuideModal.tsx`

Important existing tests:

- `tests/unit/fulfillment-state.test.ts:1-170`
- `tests/unit/square-orders.test.ts:1-26`
- `tests/unit/webhook-signatures.test.ts:1-23`
- `tests/unit/purchasable.test.ts:1-77`
- `tests/unit/preview-catalog-safety.test.ts:1-86`

## Required implementation

### 1. Add provider-neutral schema fields first

Use an additive migration. Preserve every legacy Printful field during the first release.

Recommended minimum:

- `fulfillments.provider` text, backfilled to `printful` for existing Printful rows
- `fulfillments.providerOrderId` text, backfilled from `printfulOrderId`
- change or supplement `providerStoreId` with a text-compatible provider store reference
- unique `(provider, providerOrderId)` when an external order ID exists
- unique `(orderId, provider)` or another deliberate multi-provider grouping key
- `order_items.fulfillmentProvider`
- `order_items.providerVariantId` or `providerSku`
- `order_items.providerSnapshotJson`
- `shipments.provider`
- `shipments.providerShipmentId`

Do not rename or drop `printful*` columns until historical data has been backfilled, read paths are migrated, and rollback has been proven.

### 2. Introduce provider adapters

Create a provider-neutral interface around fulfillment planning and submission. Printful should become one adapter and Apliiq a second adapter.

The abstraction must cover:

- grouping items into provider orders
- building provider request payloads
- creating/submitting orders
- confirmation behavior, if applicable
- cancellation behavior
- provider status normalization
- shipment/tracking normalization
- webhook verification and event application

Preserve the existing Square payment and internal order flow. The provider adapter begins only after a paid internal order has been durably recorded.

### 3. Add an Apliiq client

Suggested files:

- `lib/apliiq/client.ts`
- `lib/apliiq/auth.ts`
- `lib/apliiq/orders.ts`
- `lib/apliiq/webhooks.ts`
- `lib/apliiq/types.ts`
- `app/api/webhooks/apliiq/fulfillment/route.ts`
- `app/api/integrations/apliiq/products/upsert/route.ts`
- `app/api/integrations/apliiq/products/search/route.ts`

Authentication:

- Follow Apliiq’s current official HMAC documentation exactly.
- Authorization header: `x-apliiq-auth`
- Documented value structure: `RTS:SIG:APPID:STATE`
- Never invent or log the shared secret.
- Use constant-time comparisons for incoming HMAC verification.
- Verify against the raw request body before JSON parsing.

Official references:

- API overview: `https://help.apliiq.com/portal/en/kb/articles/apliiq-api-overview`
- Authentication: `https://help.apliiq.com/portal/en/kb/articles/authentication`
- Create order: `https://help.apliiq.com/portal/en/kb/articles/create-order`
- Fulfillment callback: `https://help.apliiq.com/portal/en/kb/articles/fulfillment-url`
- Add-to-store callback: `https://help.apliiq.com/portal/en/kb/articles/using-the-add-to-store-webhook`
- Product API: `https://help.apliiq.com/portal/en/kb/articles/product-api`
- Swagger: `https://devconnector.apliiq.com/swagger/index.html`

Do not assume a base URL or payload field from memory. Pin the live documented API contract in tests/fixtures before implementation.

### 4. Product mapping

Apliiq custom-store orders use Apliiq `APQ-...` SKUs. Keep Square catalog IDs and fulfillment-provider SKUs separate.

Add a new mapping file rather than replacing the Printful map, for example:

- `data/apliiq-map.json`

Suggested entry fields:

- `ahaVariantId`
- `fulfillmentProvider: "apliiq"`
- `apliiqSku`
- `apliiqProductId`, if returned
- service/decoration snapshot
- private-label reference (`SB-2-155690`) when applicable
- verified cost estimate
- supported shipping regions
- product/size-guide reference

Update `lib/data/products.ts` to merge mappings by `ahaVariantId` without deleting the historical Printful map.

Update `checkVariantPurchasable()` so provider-specific readiness is delegated to the selected provider. An Apliiq product must not be sellable without:

- Apliiq SKU
- decoration/branding snapshot
- verified landed cost
- supported shipping region
- Square catalog mapping
- active product/variant status
- production, shipping, returns, image, SEO, and size-guide requirements

### 5. Environment and safety gates

Add names only to `.env.example` and Netlify configuration. Never commit values.

Recommended variables:

- `APLIIQ_API_KEY`
- `APLIIQ_SHARED_SECRET`
- `APLIIQ_API_BASE_URL`
- `APLIIQ_DEFAULT_SHIPPING=standard`
- `APLIIQ_LIVE_MODE=false`
- `APLIIQ_ALLOW_CREATE_ORDERS=false`

Live submission must require all of the following:

- production runtime
- paid Square order
- provider selected as `apliiq`
- both Apliiq live switches enabled
- idempotency key present
- recipient/shipping validation passed
- variant has a verified Apliiq mapping

The first deployment must keep both Apliiq live switches false.

### 6. Webhook handling

Fulfillment callback requirements:

- read the raw body
- verify `x-apliiq-hmac`
- persist the raw event before applying it
- dedupe using provider plus a stable event/order/tracking key
- normalize status into the existing internal fulfillment state machine
- persist carrier, tracking number, tracking URL, shipped time, and raw provider payload
- enqueue the existing customer notification exactly once
- return success only after the event is durably recorded

Product callbacks:

- never publish or activate products automatically
- write imported product data to a reviewable draft mapping
- reject unknown/missing Apliiq SKUs
- require explicit catalog approval before a product becomes purchasable

### 7. Testing

Add tests parallel to the existing Printful tests:

- exact HMAC signing fixture from official documentation
- signature rejection and constant-time comparison behavior
- Create Order payload shape
- standard shipping default
- APQ SKU validation
- item grouping by provider
- idempotent create-order behavior
- webhook dedupe
- tracking normalization
- mixed Printful/Apliiq carts, or explicitly reject them until supported
- Apliiq live gates remain off in preview, development, and the first production deploy
- historical Printful rows still reconcile

Run at minimum:

- focused unit tests
- full unit suite
- TypeScript check
- lint
- production build
- readiness checks
- preview catalog safety test

## Square catalog cleanup plan

A read-only Square API snapshot was taken on 2026-08-16.

Snapshot:

- 242 total Square `ITEM` objects
- 122 already soft-deleted
- 120 active
- 118 active `REGULAR` catalog items are archive candidates
- 2 active legacy service items must be preserved pending separate review:
  - `Billable Hour`
  - `Discount`

Exact archive candidates are frozen in:

- `docs/square-catalog-archive-candidates-2026-08-16.json`

Do not archive anything based only on a name search. Use the exact catalog IDs in that file and re-fetch each item immediately before applying a destructive action.

### Cleanup sequence

1. Do not change Square during the Apliiq adapter coding phase.
2. Create a fresh pre-change export and compare it against the frozen 118-candidate file.
3. Refuse to proceed if:
   - active candidate count is not exactly 118
   - a candidate ID has changed or is already deleted unexpectedly
   - any new post-snapshot products appear
   - `Billable Hour` or `Discount` enters the destructive set
4. Unpublish/disable the current storefront catalog before archiving Square items, so checkout cannot reference deleted Square variation IDs.
5. Preserve:
   - all Square orders, payments, refunds, customers, images, and reporting history
   - `data/square-map.json` as a legacy mapping snapshot
   - all Printful order IDs and item/file/placement snapshots
   - the database order and webhook history
6. Archive only the 118 parent `REGULAR` item objects. Use Square’s supported soft-delete/archive behavior, never manual hard deletion of order history.
7. Re-fetch the catalog and verify:
   - 118 targeted parents are deleted/archived
   - preserved service items remain active
   - no new fall/winter items were touched
8. Keep the storefront closed until the new Apliiq/Square mappings pass sample, pricing, and live-pilot checks.

### Cleanup implementation safety

If a script is created, it must default to dry-run and require an explicit `--apply` flag. It must print names and IDs before applying, compare the expected count of 118, and stop on any mismatch. Do not run the apply mode without a separate user confirmation at that time.

## Rollout order

1. Add additive schema and provider adapters.
2. Add Apliiq auth/client and mock tests.
3. Deploy with Apliiq live switches OFF.
4. Enter deployed callback URLs in Apliiq and verify signed test callbacks.
5. Create only the selected fall/winter Apliiq products and capture APQ SKUs.
6. Reconfirm that the saved Apliiq default card is active before the controlled pilot.
7. Order physical samples with exact AHA artwork and sewn label.
8. Approve fit, print/embroidery, label, wash test, landed cost, and delivery.
9. Create corresponding Square catalog objects and update `data/apliiq-map.json`.
10. Run one controlled live order with Apliiq auto-processing still OFF.
11. Verify Square payment, internal persistence, Apliiq order, tracking callback, notification, and support visibility.
12. Enable Apliiq auto-processing only after the controlled pilot passes.
13. Unpublish the legacy catalog, then run the separately approved Square archive plan.
14. Launch the new fall/winter collection.

## Known issue to fix while touching readiness

`.env.example` uses `PRINTFUL_WEBHOOK_SECRET`, while these files expect `PRINTFUL_WEBHOOK_SECRET_KEY`:

- `app/api/webhooks/printful/route.ts:18-31`
- `app/api/ops/webhooks/printful-test/route.ts:8-15`
- `lib/commerce/readiness.ts:25-30`

Resolve the naming mismatch without exposing or rotating the current secret unless necessary.

## Definition of done

The integration is not done until:

- historical Printful orders still reconcile
- Apliiq auth and webhook signatures pass fixtures
- Apliiq create-order is idempotent
- Apliiq callbacks are deployed and configured
- no secret appears in git or logs
- the selected APQ SKUs have physical sample approval
- landed costs and retail prices meet the margin floor
- a controlled live order completes end-to-end
- Square cleanup is separately approved and verified
- legacy Square order/support history remains intact
