# AFTER HOURS AGENDA WEBSITE — MASTER CLAUDE CODE HANDOFF

> Premium Clothing Brand Ecommerce Build · Netlify + GitHub + Square + Printful API v2 Beta
> Version: July 8, 2026 · Installed verbatim as the governing build instruction on 2026-07-08.
> Companion governing docs: `docs/MASTER-UIUX-HANDOFF-v2.md` (controlling doctrine), this repo's `CLAUDE.md`, `SOURCE_OF_TRUTH.md`, `.ai/STATE.md`, and the root `START-HERE.md`.

You are working on the After Hours Agenda clothing brand website. This is a premium 2026 headless ecommerce build for a clothing/lifestyle brand. It must combine:

1. The uploaded MASTER-UIUX-HANDOFF-v2.md
2. The clothing-brand ecommerce website requirements
3. Netlify hosting/runtime architecture
4. GitHub source control, Actions, branch protection, CI, and release discipline
5. Square payment processing
6. Printful API v2 beta as the required print-on-demand fulfillment layer

The goal is to build a real brand-selling machine, not a generic merch site.

The finished site should feel like: a premium black-background lifestyle brand with retro-grunge attitude, clean conversion paths, honest checkout, strong product storytelling, Square-secured payments, Printful v2 beta fulfillment, GitHub-controlled release safety, and Netlify-powered runtime infrastructure.

It should not feel like: a stock Shopify theme, a fragile custom checkout, a Printful mockup catalog, a slow streetwear splash page, or a cool homepage attached to a weak ecommerce system.

---

## 0. Current Platform Assumptions and Official Constraints

- **Netlify:** Deploy Previews for PRs/agent runs, branch deploys, serverless Functions, Background Functions (async up to 15 min), Scheduled Functions (cron; run only on published deploys, 30s limit — hand long jobs to Background Functions).
- **Netlify Database** (managed Postgres, migrations, preview branches) protects production from Deploy Previews/agent runs. Netlify Blobs = unstructured/KV artifacts, NOT the relational order/payment/fulfillment DB.
- **GitHub:** PRs, required status checks, protected branches, deployment environments, environment secrets, dependency review, Dependabot, optional artifact attestations. Required checks must pass before merge to protected branches.
- **Square Web Payments SDK:** browser payment-entry layer producing secure single-use tokens → backend processes with Square Payments API. Requires secure contexts + proper CSP. Tokens cover cards, gift cards, wallets, ACH, Afterpay, Cash App Pay, accepted as `source_id`. Duplicate-charge-risk calls need idempotency keys. Webhooks validated via `x-square-hmacsha256-signature`.
- **Printful API v2 beta** (required fulfillment target): catalog, pricing, size-guide, shipping rates, order estimation, draft order creation, order confirmation, shipments, webhooks (price-change, real-time stock, richer shipment data). v2 does NOT support sync products or product templates → AHA maintains its own storefront product layer mapped to Printful v2 catalog variants/files/placements. v2 orders start as draft with pending cost calc; not charged/fulfilled until confirmation endpoint. Shipping rates need country code; state code required for US/CA/AU. Webhooks HMAC-SHA256 signed; invalid/missing signatures ignored.

---

## 1. Supreme Rule

`MASTER-UIUX-HANDOFF-v2.md` is the controlling doctrine. Read and apply it before coding.

The site must obey: Useful before beautiful · Clear before clever · Fast before flashy · Accessible by default · Honest persuasion only · Calm not noisy · No fake urgency · No fake scarcity · No fake reviews · No hidden costs · No confusing checkout · No forced account creation before purchase · No decorative bloat · No inaccessible custom controls · No client-side payment or fulfillment secrets · No unmapped products purchasable · No Printful fulfillment before Square payment success · No production fulfillment from local/staging/preview/CI · No mobile-afterthought design · No unjustified third-party script.

The brand can be expressive. The ecommerce system must be precise. The checkout must be boring, fast, honest, and trustworthy.

## 2. Product Classification

Primary: **D2 — E-Commerce / DTC Store.** Secondary: **D1 — Marketing / Brand Site.** Every decision must serve conversion (buy clothing quickly and confidently) and branding (a real lifestyle label with a world, voice, POV). Not a plain catalog — a brand world with a store attached.

## 3. Project Mission

Build AHA into a premium clothing-brand ecommerce system that can: sell tees/hoodies/sweaters/accessories/future apparel; support drops; support limited/restock workflows honestly; show fit/size/fabric/care/production/shipping; process payments via Square; fulfill via Printful v2 beta; use GitHub for release control; use Netlify for hosting/runtime; stay fast/accessible/mobile-first; build trust for a smaller brand; capture email/SMS for drops/restocks; grow without a full rebuild.

Core rule: Let the brand create desire. Let the interface remove friction. Let the system protect the order.

## 4. Brand Direction

Feels like: NYC lifestyle label · black-background brand world · bright color accents · retro-grunge/90s zine energy · edgy not messy · inclusive · anti-corporate · product-led · fun but not unserious · premium without fake luxury.

Use: black background · high contrast · bright AHA accents · strong editorial imagery · IBM Plex Mono primary (unless existing design system says otherwise) · Courier New secondary/utility if consistent · bold block layouts · graphic product moments · clean product cards · calm checkout surfaces · strong whitespace/rhythm · accessible contrast · modern responsive.

Brand rules: never show "AHA" and "After Hours Agenda" together in one lockup; Black Sheep mark faces LEFT only; don't overuse the mark; don't become generic "streetwear"; no vague luxury clichés. Avoid "Elevate your wardrobe / Where fashion meets comfort / Premium apparel for modern lifestyles / Curated essentials / Timeless pieces." Sharper brand language, but money/shipping/error copy stays clear and calm.

## 5. Target Site Structure

Primary nav: Shop · New Arrivals · Best Sellers · Tees · Hoodies · Sweaters · Accessories · Drops · Lookbook · About.
Utility: Search · Account · Cart · Size Guide · Track Order.
Footer: Contact · Shipping · Returns & Exchanges · FAQ · Size Guide · Track Order · Privacy · Terms · Accessibility · Instagram · TikTok · Email signup.

Required pages (31): Home · Shop All · New Arrivals · Best Sellers · T-Shirts · Hoodies · Sweaters · Accessories · Product Detail · Cart · Checkout · Order Confirmation · Track Order · Drops · Individual Drop · Drop Archive · Lookbook · Individual Lookbook/Campaign · About/Manifesto · Size Guide · Shipping · Returns & Exchanges · FAQ · Contact · Email/SMS Signup Landing · Restock Alert Flow · Coming Soon/Drop Countdown · 404 · Accessibility Statement · Privacy · Terms.

## 6. Recommended Technical Stack

Fast, static-first: Astro / Next.js static-first / equivalent · TypeScript · React islands only where needed · token-based design system · Netlify hosting · Netlify Functions (secure backend) · Background Functions (Printful fulfillment + long reconciliation) · Scheduled Functions (recurring sync) · Netlify Database/Postgres for operational data · Netlify Blobs for unstructured artifacts · Square Web Payments SDK on checkout/payment only · Square Payments API server-side · Printful v2 beta server-side · GitHub Actions gates · Playwright E2E · axe/Lighthouse automation · manual keyboard/VoiceOver pass pre-launch.

Do NOT build as a heavy client-side SPA unless the existing repo requires it. Most pages static/SSR (home, collections, product, drops, lookbook, about, faq, shipping, returns, size guide). Dynamic isolated to: cart, checkout, payment, variant selector, restock alerts, email/SMS capture, account/order lookup, search, filters, reviews/UGC, order status. Do NOT load Square SDK globally. Do NOT load Printful code client-side.

## 7. Source of Truth Model

- **Square owns money:** token processing, payment status/ID, refunds, transactions, reconciliation, payment webhooks, payment/customer profile where used.
- **Printful v2 owns fulfillment:** catalog/variant fulfillment data, shipping rates, production/fulfillment lifecycle, shipment tracking/status/events, exceptions, stock/price events, hold/return/cancel events.
- **AHA site owns product storytelling:** name, slug, brand/product description, fit copy, imagery, drop/collection assignment, lookbook placement, SEO, retail price, launch timing, customer-facing product status, size-guide content, shipping/returns copy.
- **Internal database owns the glue:** AHA product/variant IDs, Square mapping, Printful v2 catalog variant mapping, print file/placement mapping, cart/session (if server-side), internal orders, order items, payment/fulfillment/shipment mapping, restock requests, email/SMS consent, webhook dedupe, audit logs, sync runs, feed snapshots.
- **GitHub owns release history:** code, tokens, component library, versioned product config, tests, Actions, deployment gates, release notes, agent handoff context, CLAUDE.md/AGENTS.md/docs.

## 8. Required Repository Audit

Before changing code, audit: `pwd`, `ls`, `find . -maxdepth 2 -type f | sort`, `git status --short`, `git branch --show-current`, `git remote -v`, `cat package.json`, `cat netlify.toml`, find CLAUDE/AGENTS/README. Determine: framework, deploy target, Netlify config, product data location, checkout/cart impl, Square status, Printful status, design system/tokens, routes, a11y/perf tooling, GitHub Actions, env requirements, committed secrets, uncommitted work. Do NOT overwrite existing work blindly. Do NOT full-visual-reset unless explicitly required.

## 9. Recommended Repo Structure

(Target below; if existing structure differs — it does: this repo is Next.js App Router with `app/`, `lib/`, `components/`, `netlify.toml` — ADAPT without breaking.)

```
src/{components/{cart,checkout,collection,forms,layout,product,search,ui,states},content/{products,collections,drops,lookbook,journal,policies},data/{product-manifest.json,square-map.json,printful-v2-map.json,size-guides.json},lib/{analytics,commerce,db,email,printful-v2,seo,square,validation,webhooks},pages,routes,styles/{tokens,globals.css},types}
netlify/{functions/{checkout-quote,create-payment,order-status,restock-request,email-subscribe,webhooks-square,webhooks-printful-v2,printful-v2-shipping-rates,printful-v2-order-estimate,printful-v2-catalog-sync}.ts,edge-functions/{security-headers,campaign-routing}.ts,background/{printful-v2-fulfill-order,printful-v2-confirm-order,process-webhook-event,reconcile-order,generate-product-feed}.ts,scheduled/{sync-printful-v2-catalog,sync-printful-v2-prices,sync-printful-v2-size-guides,reconcile-open-orders,generate-sitemap,generate-product-feed}.ts}
db/{migrations,schema,seeds}
tests/{unit,integration,e2e,accessibility,fixtures/{square,printful-v2}}
scripts/{validate-products,validate-square-map,validate-printful-v2-map,margin-check,generate-product-feed}.ts
.github/workflows/{ci,e2e,lighthouse,security,release}.yml
public/{images,social}
netlify.toml · package.json · README.md · CLAUDE.md · AGENTS.md
```

## 10. Netlify Architecture

Netlify = hosting, Deploy Previews, branch/staging, serverless backend, background runner, scheduled runner, env manager, optional DB/storage.

Contexts: Production · Staging/branch · Deploy Preview · Local. Branch model: `main`=production · `staging`=staging branch deploy · `feature/*`=Deploy Preview · `drop/*`=drop/campaign preview · `hotfix/*`=urgent prod fix.

Behavior: every PR gets a preview; `staging` persistent branch deploy; production deploys only from `main`; production env vars NOT in Deploy Previews; production Printful confirmation disabled unless explicit production flags; production Square disabled unless explicit production env flags; Deploy Preview uses Square Sandbox only and never confirms live Printful; scheduled functions not assumed in Deploy Previews; long fulfillment/reconciliation via Background Functions.

Synchronous: `/api/checkout-quote`, `/api/create-payment`, `/api/order-status`, `/api/restock-request`, `/api/email-subscribe`, `/api/printful-v2/shipping-rates`, `/api/printful-v2/order-estimate`, `/api/webhooks/square`, `/api/webhooks/printful-v2`.
Background: `printful-v2-fulfill-order`, `printful-v2-confirm-order`, `process-webhook-event`, `reconcile-order`, `generate-product-feed`.
Scheduled: `sync-printful-v2-catalog`, `sync-printful-v2-prices`, `sync-printful-v2-size-guides`, `reconcile-open-orders`, `generate-sitemap`, `generate-product-feed`.
Edge only for: security headers, lightweight redirects, campaign routing, non-sensitive personalization, safe geo shipping language. No payment/fulfillment/PII/secrets in Edge unless specifically secure.

## 11. Environment Variables

`.env.example` with placeholders only. Groups: Site (`SITE_URL, PUBLIC_SITE_URL, ORDER_SUPPORT_EMAIL, NODE_ENV`) · Database (`DATABASE_URL`) · Netlify (`NETLIFY_SITE_ID, NETLIFY_AUTH_TOKEN`) · Square (`SQUARE_ENVIRONMENT=sandbox, SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID, SQUARE_ACCESS_TOKEN, SQUARE_WEBHOOK_SIGNATURE_KEY, SQUARE_API_VERSION`) · Printful v2 (`PRINTFUL_API_VERSION=v2-beta, PRINTFUL_API_BASE_URL=https://api.printful.com/v2, PRINTFUL_API_TOKEN, PRINTFUL_STORE_ID, PRINTFUL_WEBHOOK_SECRET, PRINTFUL_DEFAULT_SHIPPING=STANDARD, PRINTFUL_DEFAULT_CURRENCY=USD, PRINTFUL_DEFAULT_SELLING_REGION=north_america, PRINTFUL_ALLOW_CONFIRM_ORDERS=false, PRINTFUL_LIVE_MODE=false`) · Email/SMS · Analytics (`ANALYTICS_*, META_PIXEL_ID, TIKTOK_PIXEL_ID, GOOGLE_MERCHANT_CENTER_ID`).

Production launch requires: `SQUARE_ENVIRONMENT=production`, `PRINTFUL_ALLOW_CONFIRM_ORDERS=true`, `PRINTFUL_LIVE_MODE=true`.

Rules: never commit `.env`; never expose Square/Printful tokens or webhook secrets client-side; Square Sandbox + Printful non-live in local/preview/staging; no live Printful confirm without explicit production flags; no real secrets in prompts/comments/docs/screenshots/issues/commits.

## 12. GitHub Workflow and Release Discipline

Protect `main`: require PR, required status checks, up-to-date branch, conversation resolution, no direct pushes, admins included if practical, linear history preferred, production deployment approval via GitHub Environment if configured.

Required status checks before merge to `main`: `ci/{lint,typecheck,unit-tests,build,product-data-validation,square-map-validation,printful-v2-map-validation,margin-check}`, `e2e/{product-flow,cart-flow,checkout-sandbox-flow}`, `accessibility/{axe,keyboard-smoke}`, `performance/lighthouse`, `security/{dependency-review,secret-scan}`.

Workflows: `ci.yml` (pull_request, push staging/main, dispatch → install, lint, typecheck, unit-tests, build, product/square/printful-v2 validation, margin-check) · `e2e.yml` (product/cart/checkout-sandbox/order-status/restock flows) · `lighthouse.yml` (home/collection/pdp/cart/checkout perf) · `security.yml` (dependency-review, npm-audit, secret-scan, codeql if supported) · `release.yml` (tag-release, changelog, verify Netlify production deploy, smoke-test live site).

CI MUST NOT: create live Square charges, confirm live Printful orders, send real SMS/email, mutate production product data, run production fulfillment, use production tokens in PRs from untrusted branches. CI MAY: use Square Sandbox, mocked Printful v2 payloads, validate mapping vs cached catalog, validate webhook signatures via fixtures, run local DB migrations, test order state machine, test launch readiness.

## 13. Product Data Model

Storefront product system is internal. Do NOT depend on Printful v2 sync products/templates.

Product fields: `aha_product_id, slug, title, short_description, full_description, product_type, collection_ids, drop_id, status, launch_date, retail_price, currency, fit_description, fabric_description, garment_weight, print_method, care_instructions, production_note, shipping_note, returns_note, size_guide_id, featured_image, gallery_images, lifestyle_images, seo_title, seo_description, og_image, badges, sort_priority, created_at, updated_at`. Statuses: draft, coming_soon, active, hidden, sold_out, archived, discontinued.

Variant fields: `aha_variant_id, aha_product_id, sku, size, color, retail_price, currency, status, square_catalog_object_id, square_variation_id, square_location_id, printful_catalog_product_id, printful_catalog_variant_id, printful_source=catalog, printful_region_availability, printful_placements, printful_file_url_or_file_id, printful_technique, printful_size_guide_reference, cost_estimate, margin_estimate, sort_order, created_at, updated_at`. Statuses: active, coming_soon, sold_out, unavailable, hidden, archived, manual_review.

No active variant purchasable unless: product active, variant active, Square mapping exists, Printful v2 catalog variant ID exists, placement data exists, print file URL/ID exists, retail price exists, size exists, color exists if applicable, size guide exists, production/shipping/return copy exists, margin check passes, region availability passes, images present, SEO present.

## 14. Database Schema

Netlify Database/Postgres or equivalent. Tables: products, product_variants, product_images, collections, drops, lookbook_entries, size_guides, square_catalog_map, printful_v2_variant_map, printful_v2_catalog_snapshots, orders, order_items, payments, fulfillments, shipments, customers, carts, cart_items, restock_requests, email_subscribers, sms_subscribers, webhook_events, audit_log, sync_runs, inventory_snapshots, price_snapshots, product_feed_snapshots.

- **orders:** id, external_order_number, customer_id, email, phone, shipping_name, shipping_address_json, billing_address_json, currency, subtotal/shipping/tax/discount/total_amount, payment_status, fulfillment_status, customer_status, square_payment_id, square_order_id, printful_order_id, risk_status, created_at, updated_at.
- **order_items:** id, order_id, aha_product_id, aha_variant_id, sku, title/size/color_snapshot, quantity, unit_price, line_total, square_variation_id, printful_catalog_variant_id, printful_placement_snapshot_json, printful_file_snapshot_json, fulfillment_status, timestamps.
- **webhook_events:** id, provider, event_id, event_type, signature, signature_valid, raw_payload, processed_at, processing_status, dedupe_key, created_at.
- **audit_log:** id, entity_type, entity_id, action, old_status, new_status, source, actor, metadata_json, created_at.

Rules: store external IDs; snapshot product/order data at purchase time; store raw webhook payloads before processing; dedupe every webhook; idempotent state changes; keep payment/fulfillment status separate; no raw card data; minimize PII; never log Square tokens or Printful tokens.

## 15. Product Launch Validation

`scripts/validate-products.ts` — fail build if any active product lacks title, slug, retail price, currency, description, size guide, fit note, fabric note, care, production note, shipping note, return note, ≥1 active variant, images, SEO title/description, OG image, collection/drop.
`scripts/validate-printful-v2-map.ts` — fail if any active variant lacks Printful v2 catalog product ID, catalog variant ID, placement, file URL/ID, technique, region availability, size-guide reference, cost estimate where available.
`scripts/validate-square-map.ts` — fail if any active variant lacks Square catalog object ID, variation ID, location ID if required, price mapping, currency mapping.
`scripts/margin-check.ts` — fail if retail price missing, fulfillment cost missing where required, price below margin threshold, free-shipping margin negative beyond allowed, misleading compare-at, invalid sale price.

No unmapped product goes live. No "fix it later" mapping.

## 16. Homepage Requirements

Answer within 5s: what is this / what's sold / why care / what to do first / why trust it. Above fold: strong hero image or optimized video, clear headline, short subheadline, primary CTA (Shop New Arrivals), secondary CTA (View Latest Drop / Shop Best Sellers), visible nav, visible cart/search, no popup before value, no carousel hero. Sections: hero, new arrivals, featured drop, best sellers, category blocks, manifesto snippet, lookbook band, quality/fit/shipping reassurance, honest social proof, email/SMS signup, footer. No vague hero copy, no heavy mobile video unless optimized, no autoplay audio, one primary action per viewport, mobile-first, obvious product path.

## 17. Collection / Shop Pages

Scan, filter, buy. Grid with image, name, price, variant preview, availability, quick add where safe. Filters: size, color, type, price, availability. Sort: featured, newest, best sellers, price. Filter reset, no-results state, mobile filter drawer, pagination/sensible lazy load. Card: image, name, price, availability badge only if true, secondary hover image (desktop), mobile tap behavior, sold-out state, restock CTA if sold out, New/Limited/Restocked/Best Seller badges only when true. No fake scarcity/popularity; don't hide sold-out with brand/archive value.

## 18. Product Detail Page

Most important sales page. Above fold (mobile): image, name, price, size selector, add to cart, shipping/production note, return note, payment trust note/wallet. Content: name, price, size buttons, colors, front/back/detail images, model/lifestyle, flat lay, fit description, fabric composition, garment weight, print method, care, production estimate, shipping estimate, return summary, size guide near selector, reviews/UGC if real, related products, complete-the-fit, restock alert if unavailable.

Size selector: visible buttons not hidden dropdowns; unavailable sizes disabled-but-visible with reason; sold-out size supports Notify me; size guide one tap away; product-specific fit note visible. Add-to-cart disabled if: no size, inactive variant, sold out, coming soon, Square mapping missing, Printful v2 mapping missing, placement/file missing, region unavailable, validation failed. Immediate feedback: added state, cart drawer/confirmation, continue shopping, checkout path, screen-reader announcement.

## 19. Size and Fit System

Conversion feature. Size guide: product-specific measurements, inches+cm, chest width, body length, sleeve length, shoulder width where relevant, waist/inseam where relevant, how-to-measure diagram, fit description, model sizing, size up/down if..., customer fit feedback when reviews exist. Fit language: true to size, relaxed, boxy, oversized, heavyweight, midweight, cropped, longline, standard unisex. Don't reuse one generic chart across blanks with different measurements.

## 20. Cart

Clear, editable, trustworthy. Image, name, size, color, quantity editor, remove, unit price, line total, subtotal, shipping/free-shipping message, tax estimate where possible, total before checkout where possible, express checkout where appropriate, continue shopping, secure checkout CTA, production/shipping expectation, cart persistence. Rules: revalidate before checkout; never trust client price; never hide costs; no surprises; no forced account; no confusing promos; instant updates; explain unavailable items. If free shipping: "Free shipping on every order. No code needed."

## 21. Checkout

Mobile-first, wallet-first, guest-first, clear, fast, accessible, honest, idempotent, server-validated. Steps: contact email, shipping address, shipping/production estimate, order review, Square payment method, payment, confirmation. Guest primary; wallets prominent on mobile; address autocomplete if available; billing=shipping default; 6–8 visible fields; inline validation; errors tied to fields; final total visible before payment; pay button states financial action; no hidden fees; no fake urgency; no account before purchase (offer after). Good pay buttons: "Pay $48.20", "Place order", "Complete purchase". Avoid Submit/Continue/Proceed/Confirm for financial actions.

## 22. Square Payment Architecture

Square Web Payments SDK only on payment/checkout surfaces. Frontend: load SDK only during checkout, render enabled methods, tokenize, send single-use token to backend, no card storage, no token logging, clear errors, prevent duplicate clicks, accessible states. Backend: receive token, revalidate cart, recalc price server-side, revalidate shipping/tax, create/update internal order, create Square payment via Payments API with idempotency keys, store payment ID + order/customer IDs if used, handle failures, trigger Printful fulfillment only after payment success.

Sequence: checkout → load SDK → choose method → SDK single-use token → POST token+cart/session to `/api/create-payment` → validate cart/totals → Square payment with idempotency key → success → `payment_status=paid` → background fulfillment → Printful v2 draft → confirm after validation → confirmation.

Square webhooks: payment created/updated, refund created/updated, order updated (if Orders API), customer events (if Customers API). Rules: validate `x-square-hmacsha256-signature`; reject invalid; store raw payload; dedupe; 2xx fast; heavy work async; never double-create Printful fulfillment; webhook is reconcile not first order-creation path.

## 23. Printful API v2 Beta Architecture

Required fulfillment layer. Do NOT build fulfillment on v1 unless a specific missing endpoint needs a temporary, documented adapter. Use v2 for: catalog lookup, product/variant fulfillment data, size-guide/catalog data, pricing, images, shipping-rate calc, order estimation, draft order creation, order item creation, draft/failed order updates, order confirmation, shipment tracking, fulfillment webhooks, stock events, price-change events, signed webhook validation.

Constraint: v2 does NOT support sync products/templates. Therefore keep AHA product layer internal; map to v2 catalog variants; store files/placements/techniques/region availability internally; use v2 as fulfillment/catalog/shipping authority; don't make Printful the brand CMS.

## 24. Printful v2 Product Mapping

Each active variant includes: aha_product_id, aha_variant_id, sku, size, color, retail_price, currency, square_catalog_object_id, square_variation_id, printful_catalog_product_id, printful_catalog_variant_id, printful_source=catalog, printful_placements, printful_file_url_or_file_id, printful_technique, printful_size_guide_reference, printful_region_availability, status.

Example order item:
```json
{ "source": "catalog", "quantity": 1, "catalog_variant_id": 4011,
  "placements": [ { "placement": "front", "technique": "dtg",
    "layers": [ { "type": "file", "url": "https://example.com/production-files/design-front-v1.png" } ] } ] }
```
Rules: stable file URLs or Printful file IDs; version print files; don't silently replace files at same URL unless cache/version controlled; store original design source path + production-ready URL + placement + technique + approval/test status; no launch without successful payload validation.

## 25. Printful v2 Fulfillment Flow

Payment completes through Square BEFORE Printful confirmation. Sequence: checkout complete → Square payment success → internal order created/paid → `payment_status=paid` → Netlify Background Function starts fulfillment → v2 draft order → attach items from catalog source → Printful calculates costs → validate costs/address/items/mapping/margin → confirm v2 order if valid → `fulfillment_status=confirmed/submitted_to_printful` → webhooks update production/shipment → customer-facing status updates.

Forbidden: Printful confirm before Square success; client-side Printful calls; trusting client prices; confirm from GitHub Actions; confirm from Deploy Previews; confirm from staging without explicit live flags; shipping promises before validation. Orders are draft first, then confirmed. Don't assume immediate fulfillment.

## 26. Printful v2 Shipping Strategy

Rates close to checkout: collect destination, request v2 rates, store method + quoted cost + estimated delivery window + production expectation, revalidate before payment, reconcile actual cost after confirmation. US/CA/AU require state/province code. If free shipping: calculate real Printful cost internally, store true cost, track margin after shipping, show free shipping customer-facing, don't imply instant shipping, don't promise "3–5 days" unless production+transit truly fits. Copy: "Free shipping on every order. Made to order. Delivery includes production time plus carrier transit."

## 27. Printful v2 Webhooks

Events: order created/updated/failed/canceled/put-on-hold/hold-approved/removed-from-hold/refunded, shipment sent/delivered/returned, catalog stock updated, catalog price changed. Rules: validate HMAC-SHA256; reject invalid/missing; store raw event + ID/signature/timestamp; dedupe; respond fast; heavy work in background; never duplicate fulfillment; never overwrite newer status with older; route hold/failed/invalid to manual review; notify customers only when relevant.

## 28. Order State Machine

Separate payment and fulfillment. Payment: created, payment_pending, paid, payment_failed, payment_canceled, refunded, partially_refunded, chargeback, manual_review. Fulfillment: not_started, queued, draft_creating, draft_created, items_adding, costs_calculating, ready_to_confirm, confirmation_pending, confirmed, in_production, on_hold, hold_approved, hold_removed, partially_fulfilled, shipped, delivered, returned, canceled, failed, manual_review. Customer-facing: Order received, Payment confirmed, In production, Shipped, Delivered, Issue detected, Refunded, Canceled. Don't expose raw Printful statuses untranslated.

## 29. Order Confirmation and Status Page

Confirmation shows: order number, email, items, size/color/qty, total paid, payment confirmed, production expectation, shipping expectation, free-shipping message if applicable, support link, track order link, account creation/save after purchase. Status page shows: customer-facing status, simplified payment/fulfillment/shipment status, tracking URL when available, estimated delivery when available, split-shipment notice if applicable, support path for holds/issues/returns, clear fallback if no tracking yet. Don't show scary internal language unless required.

## 30. Drops System

Current drop page, upcoming drop page, drop archive, countdown only if real, email/SMS early access, limited-quantity language only if true, restock request, sold-out state, post-drop archive, shop-the-drop CTA. Structure: drop hero, story, product grid, lookbook/editorial, email/SMS signup, related archive/next-drop teaser. Forbidden: fake countdowns/scarcity/social proof/"only 2 left"/untrue pressure copy. Honest scarcity allowed; fake urgency not.

## 31. Lookbook / Editorial

Create desire and brand memory. Campaign images, styled outfits, shop-the-look links, drop storytelling, captions, mobile-first crops, archive by season/drop, product links inside editorial. Lookbook must not block shopping; every editorial section has a clear path back to product.

## 32. About / Manifesto

What AHA is, what the name means, Black Sheep symbol story if relevant, values, founder/brand note if desired, cultural POV, link to current drop, link to shop. Tone: direct, stylish, anti-corporate, inclusive, culturally aware, clear.

## 33. Email, SMS, Restock, Retention

Capture: footer, homepage, drop page, restock, sold-out product, post-purchase opt-in, non-invasive exit-intent only if appropriate. Language: "Get the next drop first." / "Join the agenda for drop alerts and restocks." / "No spam. Just drops, restocks, and the occasional bad idea." Automations: welcome, abandoned cart, browse abandonment, restock alert, drop announcement, post-purchase thank you, production/shipping update, review request, winback. Transactional from backend events (Square payment success, internal order created, Printful confirmed, shipment sent/delivered, refund, return issue). Don't send production/shipping messages from frontend-only assumptions.

## 34. Reviews and UGC

When available: star rating, written review, photo review, size purchased, fit rating (runs small/true/large), review filters, customer photos, social proof. Never fabricate reviews/photos/popularity. No reviews → honest empty state: "No reviews yet. Be one of the first to wear it and leave a fit note for the next person."

## 35. Search

Product search, typo tolerance if available, suggested products, thumbnails, collection suggestions, recent searches if useful, no-results recovery, mobile overlay. No-results copy: "No products matched '…'. Try clearing filters, searching '…', or viewing all available sizes." No blank no-results screens.

## 36. Account / Returning User

Return visits: recently viewed, saved cart, order status, requested restock alerts, recommendations, past orders if logged in, faster checkout, remembered size if account+consented. Account: order history, saved addresses, wishlist/saved items, restock alerts, email/SMS preferences, easy logout, data/privacy controls. No forced account before checkout; offer after purchase.

## 37. Trust Builders

Real photography, clear contact, support email, shipping page, returns/exchanges page, FAQ, order tracking, secure checkout indicators, payment options, quality details, fulfillment transparency, real reviews, social links, accessibility statement, privacy policy, terms. Trust is interface behavior, not a claim.

## 38. SEO and Merchant Visibility

Product schema, merchant/product structured data, collection metadata, clean URLs, alt text, Open Graph, Twitter/X cards, sitemap, robots.txt, canonical URLs, Google Search Console, Google Merchant Center feed, fast indexable pages, HTML collection descriptions, internal linking, product feed generation, drop archive indexing. Product pages: name in title, price, availability, image, description, brand, SKU if available, shipping/return info where supported, canonical URL.

## 39. Performance

Targets: LCP ≤2.0s preferred / ≤2.5s max · INP ≤150ms preferred / ≤200ms max · CLS ≤0.05 preferred / ≤0.1 max. Static-first, minimal JS, WebP/AVIF, responsive sizes, explicit dimensions, lazy-load below-fold, no heavy mobile hero video unless essential+optimized, no third-party scripts on product pages unless justified, Square SDK only on checkout, reviews/UGC lazy-loaded, email popup delayed/non-blocking, product grids paginated/virtualized if large, instant cart interactions, no layout shift, max two font families, `font-display: swap`, third-party scripts documented as perf/privacy line items. Every third-party integration must justify itself.

## 40. Accessibility (WCAG 2.2 AA working standard)

Semantic HTML, heading hierarchy, keyboard nav, visible focus, skip links where useful, useful alt text, always-visible labels, field-tied errors, cart updates announced, no color-only meaning, token-level contrast, usable touch targets, reduced motion respected, no hover-only functionality, resizable text, accessible auth, password managers supported, accessibility statement. Ecommerce-critical: size buttons keyboard accessible, selected size announced, disabled sizes explain why, add-to-cart success announced, cart drawer focus trap/release, modals close with Escape, checkout autocomplete, payment errors field-tied, loading states don't strand, pay button describes financial action, countdown not the only launch-time explanation.

## 41. Required UI States

Product: available, low_stock_only_if_true, sold_out, back_in_stock, preorder, coming_soon, discontinued, sale, new, restocked, manual_review. Page: loading, empty, error, success, offline, no_search_results, payment_failed, address_invalid, cart_empty, order_placed, order_processing, order_shipped, order_delivered, return_started, fulfillment_hold, manual_review. Each state explains: what happened, why it matters, what to do next. No blank states.

## 42. Copy and CTA Rules

Good: Shop new arrivals · View latest drop · Add to cart · Place order · Pay $48.20 · Track shipment · View size guide · Join the next drop · Notify me when restocked · Complete purchase. Avoid Submit/Continue/Learn more/Click here/Proceed unless outcome is obvious. Error formula: what happened + why if known + how to fix (e.g., "We couldn't process the payment because the card was declined. Use a different payment method or contact your bank."). Brand surfaces sharp/strange/playful/anti-corporate; money/errors/shipping/returns/privacy/accessibility clear and calm.

## 43. Security

Secrets: none in repo, none in browser bundle, runtime in Netlify env vars, GitHub Actions secrets only for CI, production secrets restricted to production context, sandbox secrets restricted to sandbox/staging, rotate after setup, never paste live tokens anywhere. Webhooks: Square + Printful v2 signature validation required, store raw event, dedupe, respond fast, heavy work async, reject invalid, no secrets in query strings. Payment: never collect/store/log card data or tokens, use tokenization, CSP, HTTPS, idempotency keys, disable duplicate submit, no live payments outside production mode. Fulfillment: never expose Printful token client-side, never confirm before Square success, never confirm in Deploy Preview/GitHub Actions, never confirm unless `PRINTFUL_ALLOW_CONFIRM_ORDERS=true` AND `PRINTFUL_LIVE_MODE=true`.

## 44. Analytics

Track: product/collection views, size-guide clicks, variant selections, add-to-cart, cart updates, checkout started, payment method selected, payment failed/completed, Printful draft created, Printful confirmed, fulfillment failed, shipment sent/delivered, restock/email/SMS signup, drop page view, lookbook-to-product click, search query, no-results search, return/refund reason, margin after fulfillment/shipping, repeat purchase rate, revenue by source, mobile conversion rate, INP on add-to-cart and checkout. Don't over-collect PII. Analytics must not block rendering or checkout.

## 45. QA

Checkout QA: successful Sandbox card, failed card, insufficient-funds failure, duplicate-click protection, refresh during payment, back button during checkout, invalid address, missing required field, sold-out product in cart, price changed during checkout, Printful/Square mapping missing, Printful fulfillment failure, Printful/Square webhook success, webhook replay, invalid signature, order confirmation, order status lookup, refund state if implemented. Device QA: iPhone Safari/Chrome, Android Chrome, iPad Safari, desktop Safari/Chrome/Firefox, slow 4G, reduced motion, keyboard only, VoiceOver smoke. Drop QA: coming-soon, countdown, live, reveal, high-traffic grid, sold-out, restock alert, email capture, archived. Accessibility QA: keyboard through home/PDP/cart/checkout, size selector, cart drawer, payment error, labels, focus, reduced motion, touch targets, SR announcements. Performance QA: home, collection, PDP, cart, checkout, drop, lookbook. Fail release if budgets regress.

## 46. Build Order

**Phase 1 — Audit and foundation:** audit repo, confirm framework, confirm Netlify, confirm Square/Printful status, add/update CLAUDE.md, AGENTS.md, README.md, netlify.toml, design tokens, product data schema, DB schema/migrations, env docs, GitHub workflow gates, secret-scan/security workflow.
**Phase 2 — Product and storefront:** product data validation, product card, collection/shop page, PDP, size guide system, product state system, cart, checkout shell, order confirmation, order status page.
**Phase 3 — Commerce backend:** cart server validation, checkout-quote function, Square payment wrapper, Square payment function, internal order creation, idempotency, payment failure states, Square webhook handler + signature validation, payment reconciliation.
**Phase 4 — Printful v2 fulfillment:** v2 client wrapper, catalog sync, size-guide sync, shipping-rate function, order estimate, draft order creation, order item creation, cost validation, order confirmation, webhook handler + signature validation, fulfillment reconciliation.
**Phase 5 — Brand systems:** homepage, drops, drop archive, lookbook, about/manifesto, journal/editorial if needed, reviews/UGC, restock alerts, email/SMS capture.
**Phase 6 — Launch hardening:** accessibility audit, Lighthouse, mobile QA, Square Sandbox checkout QA, Printful v2 mocked/test payload QA, webhook replay, legal/policy pages, SEO/schema, product feed, production env setup, production smoke test, release notes, launch.

## 47. Required CLAUDE.md Update

(See repo `CLAUDE.md` — governing block installed there per this section.)

## 48. Required Acceptance Criteria

(Full checklist retained from spec — brand understood in 5s; mobile add-to-cart fast; PDP has size/fit/material/care/production/shipping/returns; product-specific size guide; mapping validation blocks broken products; cart revalidates server-side; guest checkout; wallet-first where Square enables; Square SDK only on payment; idempotency keys; token never logged; access token never client-side; Square webhook signature validation; Printful v2 used; Printful token never client-side; v2 draft-first; confirm only after Square success; confirm blocked outside production flags; v2 webhook signature validation; separate payment/fulfillment status; clear customer-facing status; honest shipping/production timing; accurate free-shipping language; no fake urgency/reviews/hidden costs; accessible checkout/selectors/cart/confirmation; Netlify Deploy Previews + staging work; branch protection blocks broken merges; Actions run product/payment/fulfillment/a11y/perf/security gates; performance budgets pass; mobile QA passes; webhook replay passes; failed payment clear; failed fulfillment → manual review; production launch requires explicit credential switch.)

## 49. Non-Negotiables

Never ship: generic PDPs without fit detail; cards without prices; hidden sold-out sizes; vague CTAs; placeholder-only labels; fake countdowns/scarcity/reviews; hidden/surprise costs; forced account before checkout; bloated animation hurting perf; squeezed-desktop mobile layouts; unclear checkout totals; unhelpful error states; color-only status; inaccessible custom controls; unoptimized hero media; unjustified third-party apps; client-side Square/Printful tokens; live Square charges from CI/staging; live Printful confirmations from CI/staging/preview; active products without Square/Printful v2 mapping; products with no production/shipping clarity; silent fulfillment failures; webhook handlers without signature validation or dedupe; any interface where a user would feel tricked once they understand what happened.

## 50. Final Instruction

Build as a serious 2026 ecommerce system. Do NOT start by decorating the homepage. Start by auditing the repo, then establish the system foundation: (1) repo audit (2) Netlify config (3) GitHub workflow gates (4) product schema (5) product validation (6) Square mapping validation (7) Printful v2 mapping validation (8) cart validation (9) Square Sandbox checkout (10) Printful v2 draft/confirm flow (11) webhook validation (12) PDP/cart/checkout states (13) performance/accessibility pass (14) brand polish.

The visual result should feel like After Hours Agenda. The system underneath should behave like a serious ecommerce machine. Final rule: AHA should feel like a brand people want to belong to, but the checkout, payments, fulfillment, and deployment process should be calm, boring, safe, fast, and hard to break.
