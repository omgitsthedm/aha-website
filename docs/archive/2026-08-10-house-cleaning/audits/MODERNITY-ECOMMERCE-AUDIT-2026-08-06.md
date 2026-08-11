# Modernity & E-Commerce Perfection Audit — After Hours Agenda

**Scope:** `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/aha-website`  
**Date:** 2026-08-06  (local checkout `6f36aea` on `main`, production deploy `6a67989` / `6194668`)  
**Auditor:** Senior full-stack (read-only, no mutations)  
**Baseline checked:** `package.json`, `tsconfig.json`, `next.config.mjs`, `netlify.toml`, `tailwind.config.js`, `app/` (44 routes), `lib/`, `components/`, `data/`, `scripts/`, `db/schema.ts`, `public/`, `.github/workflows/`, `AGENTS.md`, `SOURCE_OF_TRUTH.md`, `docs/`, `npm outdated`, `npm view` for latest tags, `grep` for image/security usage  

> Do NOT fix — findings only. Concrete gaps vs. strengths, each with evidence.

---

## 0 — Executive summary

| Verdict | Detail |
|---|---|
| **Overall grade: A- (modern, commerce-grade, intentionally conservative)** | The storefront is on the current **Next 15** stable line, has a **pure App Router** architecture, **strict TS**, **disciplined CSP/security**, **server-authoritative checkout** (Square prices + tax, idempotency, quote-changed guard), **Printful v2 dual-mode fulfillment** (`manual`/`dry-run`/`auto`), and **strong operational docs**. The conservatism is intentional: it is **1 minor behind** on the framework that would be risky to chase on a live payment storefront. |

**Top strengths (keep):** Next 15.5.20 still supported; CSP + webhook HMAC + fulfillment-state machine are unusually thorough for a boutique; image pipeline (AVIF/WebP + `ResilientImage` + LCP-aware fade) is e-commerce grade; `AGENTS.md`/`SOURCE_OF_TRUTH.md` make the repo operable by a new agent in <10 min.

**Top debts (schedule, not emergency):** React 18 vs 19, Tailwind 3 vs 4, ESLint 8 vs 9, Node 20 vs 22 LTS, `@neondatabase/serverless` 0.10 → 1.1, and a thin `@types/react` 19 / `react` 18 mismatch. None break the live site today; each is a planned-migration cost.

---

## 1 — Dependency freshness vs. 2026 latest

### Evidence

`package.json` (pinned deps, `npm outdated` run 2026-08-06 without `node_modules` — `MISSING` is expected — and `npm view <pkg> version` for `latest` tag):

```
dependencies:
  next                 ^15.5.20   wanted 15.5.22   latest 16.3.0   (npm view)
  react                ^18.3.1    wanted 18.3.1    latest 19.2.8
  react-dom            ^18.3.1    wanted 18.3.1    latest 19.2.8
  @neondatabase/serverless ^0.10.4 → latest 1.1.0
  drizzle-orm          ^1.0.0-beta.22 → 1.0.0-rc.4-fb12281 wanted, latest 0.45.2 (v1 prerelease line)
  web-push             ^3.6.7     latest 3.6.7 ✓
devDependencies:
  typescript           ^5.9.3     latest 7.0.2  (5.9 is current stable for Next; 7 is beta)
  @types/react         ^19.2.14   latest 19.x
  @types/react-dom     ^19.2.3
  @types/node          ^25.3.0    (ahead of runtime NODE_VERSION=20)
  tailwindcss          ^3.4.19    latest 4.3.3
  eslint               ^8.57.1    latest 9.x
  eslint-config-next   ^15.5.20   tracks next
  @netlify/plugin-nextjs ^5.15.8
  vitest               ^2.1.8     latest 3.x
  @playwright/test     ^1.49.1    latest 1.54.x
  autoprefixer         ^10.4.24
  postcss              ^8.5.10
overrides: glob 10.5.0, postcss $postcss
engines: netlify.toml NODE_VERSION=20, local node v22.22.3
```

### Strengths

- **Next 15.5.20 is the current 15-stable.** `package-lock.json` is uniformly 15.5.20 across the tree. The project intentionally rides **15**, not `next@latest` (16.3.0). For a live Square storefront that survived a wrong-site deployment once, pinning 15 is the right call — 16.x is barely a quarter old and would be a breaking migration (async `headers()`, `cookies()`, `fetch` cache semantics).
- **Patch hygiene is tight.** `next` wanted is `15.5.22` — only **2 patches behind** at audit time. `typescript@5.9.3` is the correct peer for Next 15 (TS 7 would break `next` type augmentation today).
- **Zero high-severity advisories** in the historical `security.yml` posture (`npm audit --audit-level=high || true`) and `SECRETS_SCAN_OMIT_KEYS` correctly allowlists public `NEXT_PUBLIC_*` ids so Netlify secrets-scan does not false-fail the build — a mature detail.

### Gaps

| Gap | Severity | Evidence | Cost of staying | Migration note |
|---|---|---|---|---|
| **React 18.3.1 vs 19.2.8** | MEDIUM | `react@18.3.1` but `@types/react@19.2.14` + `@types/react-dom@19.2.3` → **major/type skew**. | Stuck on legacy `react-dom` render path; cannot use React 19 Actions / `useFormStatus` / Server Components improvements. `npm outdated` wants 19.2.8. | React 19 is a **codemod-scale** upgrade (ref, context, and `forwardRef` semantics). Next 15 supports both, but checkout/cart (`CartProvider`, `CheckoutForm`, `ExpressCheckout`) must be regression-tested under 19. Plan as a dedicated branch, not a patch bump. |
| **Tailwind 3.4.19 vs 4.3.3** | MEDIUM | `tailwindcss@3.4.19`, `postcss.config.js` still `{ tailwindcss: {} }`. Tailwind 4 shipped 2025-01, `latest` is 4.3.3. | Missing Oxide engine (~5× faster), native `@import`, `text-balance` utilities, and container queries without plugin. `tailwind.config.js` future flag `hoverOnlyWhenSupported` would become default in v4. | Tailwind 4 is **breaking**: `postcss` plugin renames to `@tailwindcss/postcss`, `content` → `source`, config is CSS-first. The existing token layer (`--c-bg`, `--aha-rose`, 484-site-name comment about `void`/`cream`) survives, but every `tailwind.config.js` call site must be audited. Do not bump speculatively. |
| **ESLint 8.57.1 vs 9.x** | LOW-MEDIUM | `.eslintrc.json` is `{ "extends": "next/core-web-vitals" }` — **ESLint 8**. Latest is 9.x (flat config). | ESLint 8 is EOL-adjacent; new `eslint-config-next` releases will eventually require flat config. No custom rules today (no `import`, `a11y`, or `tailwind` plugins). | Requires migrating `.eslintrc.json` → `eslint.config.mjs` flat config. Low risk but blocks future `next lint` upgrades. |
| **@neondatabase/serverless 0.10.4 → 1.1.0** | MEDIUM | One major behind. | Misses the 1.x fetch-pool and edge-runtime fixes. DB is Netlify/Neon-backed (`@netlify/database@1.1.0` is current), so driver lag is real. | Patch is small API-wise; test `lib/db/client.ts` and `db/schema.ts` (Drizzle) under 1.x. |
| **drizzle-orm 1.0.0-beta.22 → rc.4 / 0.45.2** | LOW | On the v1 beta line; `drizzle-kit` same beta. `latest` on the stable line is 0.45.2, prerelease wanted is `rc.4`. | API surface still moving (pgTable signatures, `bigserial` mode). Schema in `db/schema.ts` is extensive (products, variants, orders, fulfillments, auditLog) — a lag here is integration risk at migration apply (`netlify/database/migrations`). | Bump to `rc.4` in lockstep with `drizzle-kit`; run `db:generate` + local migrate dry-run. |
| **@types/node 25.3.0 vs NODE_VERSION=20** | LOW | `netlify.toml` pins `NODE_VERSION=20`, local `node v22.22.3`, types are **v25**. | False-positive type errors (e.g., `fetch` / `crypto` globals) and contributor confusion. | Pin `@types/node` to `^20` or bump `netlify.toml` to `22` (22 is active LTS in 2026). Either is consistent; mixing is not. |
| **vitest 2.1.8 → 3.x, playwright 1.49 → 1.54, autoprefixer 10.4.24, drizzle-kit beta** | LOW | All 1–2 minors behind. | Misses `vitest` 3's browser mode and `playwright`'s newer WebKit fixtures. | Routine `npm outdated` sweep; low regression risk. |
| **TypeScript target ES2017** | LOW | `tsconfig.json: "target": "ES2017"`. | Emits older helpers than browsers need (browserslist already `last 2 years, iOS >=15, Safari >=15`). No `ES2022` top-level-await / class-field ergonomics. | Safe to move to `ES2022` (`browserslist` already guarantees it). Zero runtime risk. |
| **glob 10.5.0 override** | INFO | `overrides: { "glob": "10.5.0" }` — pinned to work around a transitive advisory. | Documents a prior audit fix; should be revisited each `npm audit` run. | Re-check `npm audit` after each dep bump; remove override when upstream fixes land. |

**Action:** Schedule a **quarterly dep-rotation branch** (React 19 + Tailwind 4 + ESLint 9 + Node 22) separate from feature work. Do not bundle them into a hotfix — each is a full QA pass on checkout. The current pin is *not* a modernity failure; it is a deliberate stability posture.

---

## 2 — App Router structure

### Evidence

```
app/
  layout.tsx, page.tsx, globals.css, error.tsx, loading.tsx,
  manifest.ts, sitemap.ts, robots.ts, icon.svg, apple-icon.png
  shop/[[...slug]]/page.tsx, men/[[...slug]]/page.tsx, women/[[...slug]]/page.tsx,
  unisex/[[...slug]]/page.tsx, product/[slug]/page.tsx,
  cart/page.tsx, checkout/page.tsx, order-confirmed/page.tsx, wishlist/page.tsx,
  about/, lookbook/, manifesto/, accessories/, new-arrivals/, contact/, faq/,
  shipping/, returns/, care/, size-guide/, gift-cards/ (stub), newsletter/, restock/,
  privacy/, terms/, accessibility/, account/, ops/ (+ ops/login, ops/reviews)
  api/
    checkout/{route,capture,restore}, create-payment, checkout-quote,
    webhooks/{square,printful}, commerce/readiness, search-index, size-table,
    order-status, gift-cards/purchase, account/{login,logout,request},
    lifecycle/unsubscribe, cron/lifecycle, push/subscribe, feedback,
    reviews, ops/{session,orders/[id]/retry,provider-health,webhooks/*,reviews,…},
    product-feed.xml/route.ts
components/  18 dirs: cart, checkout, product, shop, ui, seo, analytics, consent, …
lib/         16 dirs: commerce, square, printful, data, db, email, security, seo, …
data/        product-manifest.json, square-map.json, printful-v2-map.json,
             printful-cost-snapshots.json, provider-registry.json, size-guides.json
scripts/     validate-*.ts, margin-check.ts, sync-printful-costs.ts, product-factory.mjs …
db/          schema.ts (Drizzle), netlify/database/migrations
```

### Strengths

- **Pure App Router, no `pages/` fallback.** The repo never mixed routers — `app/layout.tsx` owns `metadata`, `viewport`, fonts (`Poppins`, `JetBrains_Mono` with `display:swap` and minimal weights), `CartProvider`, `SiteNav`, `SiteFooter`, `PlatformLayer`, analytics, and `CookieConsent`. This is the canonical 2025-2026 Next posture.
- **Route hygiene.** `next.config.mjs` codifies `retiredPublicRoutes` → 308 and `parkedInternalRoutes` → 307 with a correct cache comment. `app/sitemap.ts` and `app/robots.ts` are host-aware (Netlify subdomain de-indexing) and deliberately omit `lastmod` rather than fake it. `manifest.ts` is PWA-complete (maskable icons, shortcuts).
- **Colocated API routes** match domain boundaries (`lib/commerce/*` ↔ `app/api/checkout/*`, `lib/square/*` ↔ `app/api/webhooks/square`, `lib/printful/*` ↔ `app/api/webhooks/printful`). `dynamic = "force-dynamic"` on payment routes — correct.
- **Optional catch-alls** (`[[...slug]]`) for `/shop`, `/men`, `/women`, `/unisex` correctly model faceted browse without a proliferation of file-system routes.

### Gaps

| Gap | Severity | Detail |
|---|---|---|
| No route groups `(shop)` / `(marketing)` | INFO | Not a defect — the current flat layout is readable at 44 routes. Groups would help only if `(checkout)` needed a different layout (e.g., no nav). Document the decision. |
| `loading.tsx` is global only | LOW | A single `app/loading.tsx` covers all segments; per-segment skeletons (e.g., `app/product/[slug]/loading.tsx`, `app/shop/loading.tsx`) would improve perceived INP on slow Square fetches. Currently the fallback is the root spinner. |
| No `parallel` / `intercepting` routes for cart/checkout modal | INFO | Intentional — the UX uses `CartDrawer` + dedicated `/cart` + `/checkout` pages, not intercepted modals. This avoids the SEO/history traps of intercepted commerce routes. Correctly left out. |

**Verdict:** **Exemplary App Router adoption.** No legacy migration debt.

---

## 3 — TypeScript strictness

### Evidence

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "lib": ["dom","dom.iterable","esnext"],
    "allowJs": true, "skipLibCheck": true, "strict": true,
    "noEmit": true, "esModuleInterop": true,
    "module": "esnext", "moduleResolution": "bundler",
    "resolveJsonModule": true, "isolatedModules": true,
    "jsx": "preserve", "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] },
    "target": "ES2017"
  },
  "include": ["next-env.d.ts","**/*.ts","**/*.tsx",".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Strengths

- **`strict: true` is on** and `tsconfig.tsbuildinfo` proves incremental builds are exercised.
- `isolatedModules: true` + `jsx: preserve` is the correct Next + SWC posture; `moduleResolution: bundler` matches Next 15.
- Path alias `@/*` is used consistently across `lib/`, `app/`, `components/`.

### Gaps

| Gap | Severity | Detail |
|---|---|---|
| `strict` alone is the floor, not the ceiling | LOW-MEDIUM | `strict` enables 7 checks, but does **not** enable `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, or `noFallthroughCasesInSwitch` (the latter is *included* in `strict` only via `strictNullChecks` indirection — but explicit is clearer). `lib/commerce/*` and `lib/square/catalog.ts` index into `square-map.json` / `printful-v2-map.json` by `ahaVariantId` — exactly the site where `obj[key]` should be `T | undefined`. Adding `noUncheckedIndexedAccess` would have caught the class of bug that `checkVariantPurchasable` exists to guard at runtime. |
| `allowJs: true` + `skipLibCheck: true` | LOW | `allowJs` is needed only for the 6 `.mjs` product-factory scripts; it widens the check surface. `skipLibCheck` hides the `@types/react@19` vs `react@18` skew (the types claim APIs the runtime lacks). With the skew fixed, `skipLibCheck` can stay, but it currently masks the mismatch. |
| `target: ES2017` | LOW | As above — `browserslist` already promises `iOS >=15, Safari >=15`. Bumping to `ES2022` removes transpiled async-generator helpers with zero compat cost. |
| No `noUncheckedIndexedAccess` + no `erasableSyntaxOnly` / `verbatimModuleSyntax` | INFO | Future-facing; `verbatimModuleSyntax` (TS 5.9) would catch accidental value-imports of types in `lib/types/product.ts`. |

**Recommendation:** Add `"noUncheckedIndexedAccess": true` and `"noFallthroughCasesInSwitch": true` next. Keep `strict: true`; these are additive and catch the one bug class this codebase is most exposed to (map lookups).

---

## 4 — Tests / lint / typecheck results

### Evidence

- `package.json` scripts: `lint: eslint --max-warnings=0 app components lib scripts tests`, `typecheck: tsc --noEmit`, `test: vitest run`, `test:e2e: playwright test`, `validate:all: validate:products && validate:square-map && validate:printful-v2-map && margin-check`.
- `.eslintrc.json`: `{ "extends": "next/core-web-vitals" }` — single extend, no overrides.
- `vitest.config.ts`: `include: tests/unit/**/*.test.ts`, `environment: node`, alias `@`.
- `playwright.config.ts`: 4 projects (chromium/webkit/mobile-*), `fullyParallel: false`, `timeout: 60s`, `webServer: npm run start` (or `E2E_BASE_URL`), `AHA_PREVIEW_CATALOG=true` in CI.
- `tests/unit/` — **18 unit suites**: `margin`, `discounts`, `purchasable`, `fulfillment-state`, `checkout-alert`, `security`, `ops-auth`, `square-client`, `square-orders`, `webhook-signatures`, `variation`, `variation-color`, `express-checkout`, `legacy-checkout`, `product-feed`, `product-copy`, `preview-catalog`, `email-templates`.
- `tests/e2e/smoke.spec.ts` — single smoke file.
- `knip.jsonc` — ignores `public/sw.js` + 4 manual factory scripts, `ignoreBinaries: [netlify]`.
- **Live run at audit time:** `node_modules` is absent (no install), so `npm run lint/typecheck/test/build` cannot execute. `npm outdated` and `npm view` succeeded and are reported above. `tsconfig.tsbuildinfo` dated `2026-07-27` proves the last successful `tsc`/`next build`. Git log shows `fix(audit): waves 1-3` landing with green CI before `6f36aea`.

### Strengths

- **`--max-warnings=0` is strict** — the build fails on any ESLint warning. This is rarer than it should be and keeps the storefront warning-clean.
- **Domain-aligned unit coverage.** 18 suites cover the money paths: margin floor, purchasability, fulfillment-state aggregation, discounts, checkout error throttling, webhook HMAC, square client retry. `validate:all` is a **commerce-invariant gate** (product shape, square map completeness, Printful v2 placements, margin policy) that most boutiques never build.
- **Playwright is sharded correctly** — `e2e.yml` runs `product-flow` / `cart-flow` / `checkout-sandbox-flow` as separate jobs with `--grep @product/@cart/@checkout` and `--pass-with-no-tests` so the gate stays green before Phase 2-3 specs land. `AHA_PREVIEW_CATALOG=true` avoids credentialed Square fetches in CI.
- **CI gates are complete** — `ci.yml` (lint → typecheck → test → build with preview catalog), `security.yml` (dependency-review + npm audit + gitleaks), `lighthouse.yml` budgets (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1), `e2e.yml`, `release.yml` (live-site verification).

### Gaps

| Gap | Severity | Detail |
|---|---|---|
| **No local verification at audit time** | INFO (process) | `node_modules` absent → `lint/typecheck/test` could not be re-executed locally. The last known-good is the `2026-07-27` build + CI green. Re-run `npm ci && npm run lint && npm run typecheck && npm test && npm run build` before the next deploy — do not assume the present working tree is still green after 9 days of doc-only commits. |
| **ESLint is minimal** | LOW-MEDIUM | Only `next/core-web-vitals`. No `import` order, no `a11y` (`jsx-a11y` is inside `core-web-vitals` but not surfaced), no `tailwindcss` class-order, no `vitest`/`playwright` plugins. The codebase compensates with careful code, but a new contributor can introduce an `img` vs `next/image` regression without a lint error (grep today finds 0 raw `<img` — that invariant is not enforced). |
| **Coverage is unit-heavy, e2e-light** | MEDIUM | 18 unit files vs **1** `smoke.spec.ts`. `e2e.yml` explicitly `--pass-with-no-tests` for `@cart`/`@checkout` tags — the cart/checkout flows that actually charge money have no tagged Playwright specs yet. The `@product`/`@catalog` smoke exists, but the highest-risk path (add → cart → quote → Square payment → order-confirmed) is not end-to-end tested in CI. |
| **No coverage thresholds** | LOW | `vitest.config.ts` has no `coverage: { thresholds }`. The 18 suites could regress without a gate. |
| **`knip` is not in CI** | LOW | `knip.jsonc` is configured but `ci.yml` never runs `knip`. Dead-code drift will not be caught in PRs. |
| **No type-aware lint** | INFO | `@typescript-eslint` with `project: tsconfig.json` would surface promise-misuse in `lib/commerce/orders.ts` / `lib/printful/client.ts` where `await` is load-bearing. Not a failure today, but the checkout pipeline is async-heavy enough to benefit. |

**Verdict:** **Strong for a boutique, thin on e2e.** The `validate:all` commerce gates are a standout. Close the e2e gap on cart/checkout before calling the suite "e-commerce perfect."

---

## 5 — Commerce integration (Square, Printful)

### Evidence — Square

- `lib/square/client.ts`: `squareRequest` with `Square-Version: 2024-01-18`, `Authorization: Bearer`, `next: { revalidate: 300 }`, `fetchWithRetry` (3 retries, 1s/2s/4s exponential on 429), `parseSquareJson` sanitizer for control chars in catalog descriptions.
- `lib/square/catalog.ts`: eligibility index from `loadProducts()` → `buildEligibleSquareIndex()` (requires `squareCatalogObjectId + squareVariationId`), legacy collection `57JPU5ZDHXGWVPRQQZMWVR5Q` gated behind `APPROVED_LEGACY_SLUGS` (29 slugs), `unstable_cache` + `cache` for catalog reads, `previewCatalogFallbackAllowed()` for CI.
- `lib/square/orders.ts` + `app/api/create-payment/route.ts`: **server-authoritative pricing** — `revalidateCart(body.lines)` → `createPricedSquareOrder` (customer, line items, `resolveEffectiveDiscount` server-side, shipping address → location tax) → `priced.total !== quotedTotal` → `409 QUOTE_CHANGED` → persist → `Payments API` with `idempotencyKey` → `findPaidOrderByIdempotencyKey` dedupe, `findOrCreateCustomer` best-effort CRM.
- `lib/square/webhooks.ts`: `verifySquareWebhookSignature` — `HMAC-SHA256(notificationUrl + rawBody, signatureKey)` → `timingSafeEqual(base64)`, `normalizeSquareWebhookEnvironment`.
- `app/api/webhooks/square/route.ts`, `app/api/checkout/{route,capture}`, `app/api/create-payment/route.ts` all `force-dynamic`, no-store.

### Evidence — Printful

- `lib/printful/client.ts`: `printfulRequest` with `Authorization: Bearer`, `X-PF-Store-Id`, dual base URLs (`/v2` default, `/v1` for sync-variant orders), in-process sliding-window rate limiter (120/min), 429 retry with `Retry-After`.
- `lib/commerce/fulfillment.ts` + `lib/commerce/fulfillment-state.ts`: per-store `fulfillments` rows, `aggregateFulfillmentStatus`, `buildStoreOrderRequest`, `groupSourceItemsByPrintfulStore`, `isPrintfulConfirmationAllowed` gated by **both** `PRINTFUL_ALLOW_CONFIRM_ORDERS` **and** `PRINTFUL_LIVE_MODE`, `confirmPrintfulOrder` only when both true, `syncOrderFulfillmentStatus`, `markManualReview`, `enqueueOrderNotification`.
- `lib/commerce/runtime.ts`: `getCommerceEnvironment()` defaults to `production` unless `SQUARE_ENVIRONMENT=sandbox`, `getFulfillmentMode()` (`manual`/`dry-run`/`auto`), `getSquareWebPaymentsConfig()` (env-aware SDK URL), `normalizeSiteUrl`.
- `netlify.toml`: `AHA_FULFILLMENT_MODE=manual` default, `production: auto + PRINTFUL_ALLOW_CONFIRM_ORDERS=true + PRINTFUL_LIVE_MODE=true`, all other contexts `dry-run/false/false`. `SQUARE_WEBHOOK_NOTIFICATION_URL=https://afterhoursagenda.netlify.app/api/webhooks/square` (must match Square dashboard).
- `data/`: `square-map.json`, `printful-v2-map.json`, `printful-cost-snapshots.json`, `provider-registry.json` — joined in `lib/data/products.ts:loadProducts()` (manifest + squareMap + printfulMap by `ahaVariantId`).
- `scripts/`: `validate-square-map.ts`, `validate-printful-v2-map.ts`, `margin-check.ts`, `enforce-margin-policy.ts`, `sync-printful-costs.ts`, `product-factory.mjs` / `populate-maps.mjs` (map generation), `ops/commerce-readiness.mjs`.
- `db/schema.ts`: `products`, `productVariants` (with `squareCatalogObjectId`, `printfulCatalogVariantId`, `costEstimate`), `orders` (separate `paymentStatus` / `fulfillmentStatus` / `customerStatus`), `orderItems`, `squareCatalogMap`, `printfulV2VariantMap`, `printfulV2CatalogSnapshots`, `auditLog`, `fulfillments`.

### Strengths

- **Server is the price authority.** Client-quoted totals are never trusted; Square computes `subtotal + tax + shipping + discount` authoritatively and the `QUOTE_CHANGED` guard stops a stale total *before* persistence or payment. This is the single most important e-commerce correctness property and it is implemented.
- **Idempotency is durable.** `idempotencyKey` (client-generated per checkout attempt) is checked via `findPaidOrderByIdempotencyKey` before any side effect — retries do not double-charge.
- **Payment vs fulfillment are separate states.** `orders.paymentStatus` vs `fulfillmentStatus` vs `customerStatus` — fulfillment cannot be inferred from payment and vice versa. `fulfillments` is per-store, so multi-store retries reconcile independently.
- **Double-gated Printful confirmation.** Both `PRINTFUL_ALLOW_CONFIRM_ORDERS` *and* `PRINTFUL_LIVE_MODE` must be `true`, and only `context.production` sets them. Staging/preview/branch/CI are `dry-run` — it is structurally impossible to confirm a real Printful order outside production.
- **Webhook security is correct.** Both providers use `HMAC-SHA256` + `timingSafeEqual` (not `===`). Square includes `notificationUrl` in the HMAC (per Square spec); Printful uses hex key. `SQUARE_WEBHOOK_NOTIFICATION_URL` is pinned in `netlify.toml:27` to match the Square dashboard.
- **Operational maturity.** `validate:all` + `margin-check` + `audit:provider-liveness` + `verify:commerce-readiness` (name-only presence checks) + `db/schema.ts` audit log give a boutique a supply-chain posture most mid-market stores lack.

### Gaps

| Gap | Severity | Detail |
|---|---|---|
| **Tax is Square-location-tax only** | INFO | `createPricedSquareOrder` uses `lineItems: catalogObjectId + quantity` plus `shippingAddress` → Square location tax. This is correct for US physical goods, but there is no VAT/GST path for non-US fulfillment. Acceptable for a NYC label today; document the boundary. |
| **In-memory rate limiters are not durable** | LOW-MEDIUM | `lib/printful/client.ts` (120/min sliding window) and `lib/security/rate-limit.ts` (feedback/magic-link) are per-instance `Map`s. Netlify serverless functions are ephemeral and not shared — bursts across instances are not bounded. The code comments acknowledge this and point to a Neon/edge limiter as the follow-up. Correctly shipped as zero-infra, but it is a gap under load. |
| **Gift cards disabled, feed is live** | INFO | `app/gift-cards/page.tsx` is a "coming soon" stub (`GIFT_CARDS_ENABLED` off, sitemap omits `/gift-cards`), but `app/product-feed.xml/route.ts` serves Google/Meta/TikTok. The feed must not advertise gift-card SKUs while the flow is stubbed — verify `lib/seo/product-feed.ts` filters on `status === "active"` + `checkVariantPurchasable` (it does, but the stub should stay filtered). |
| **`SQUARE_API_VERSION=2024-01-18` pinned** | LOW | Current Square API is `2025-0x`. The pinned version is functional but will not receive new tax/discount fields without a bump. Schedule a version-rotation check alongside the React/Tailwind rotation. |

**Verdict:** **Commerce-grade.** The checkout → payment → fulfillment state machine is the strongest part of the codebase.

---

## 6 — Image optimization

### Evidence

- `next.config.mjs:images`: `formats: ["image/avif","image/webp"]` (AVIF first), `deviceSizes: [320,420,640,750,828,1080,1200,1600,1920]` (9), `imageSizes: [32,48,64,96,128,256,384]` (7), `remotePatterns: [items-images-production.s3.us-west-2.amazonaws.com, images.squarespace-cdn.com, *.printful.com]`, `unoptimized: AHA_PREVIEW_CATALOG === "true"` (OOM guard for preview image storms).
- `components/ui/ResilientImage.tsx`: wraps `next/image`, `priority`-aware fade (`opacity-0` + `transition-opacity` only when `!priority`), `pending` state seeded `false` so SSR/first-render/JS-off shows the image, `onError` → "Image unavailable" fallback with `role="img"` + `aria-label`, `sourceKey` reset on `src` change.
- `app/` grep: `next/image` imported in `app/page.tsx`, `app/about/page.tsx`, `app/lookbook/page.tsx`, `app/manifesto/page.tsx`, `app/accessories/page.tsx`, `app/order-confirmed/page.tsx`, `app/[men|women|unisex]/page.tsx` — **0 raw `<img` in `app/` or `components/`**.
- `public/`: `products/` (108 dirs, immutable webp), `printful-assets/` (124 dirs), `campaign/` (lifestyle), `brand/` (og-image, icons), `sw.js` (navigation-only offline fallback).
- `next.config.mjs:headers`: `/products/*` + `/brand/*` + `/fonts/*` → `immutable`, `/campaign/*` → `max-age=86400, stale-while-revalidate=604800`. `public/_headers` duplicates the same for Netlify static handling (comment explains why `next.config` headers do not apply to `public/` under the Netlify runtime).
- `tailwind.config.js`: no `@tailwindcss/aspect-ratio` — uses native `aspect-*`.

### Strengths

- **Correct format negotiation.** AVIF where supported (≈20-30% smaller than WebP), WebP fallback — visually lossless, runtime-cached encode.
- **LCP-safe fade.** `ResilientImage` explicitly disables the opacity fade for `priority` images because Chrome excludes `opacity:0` from LCP. This is a subtle, documented correctness win.
- **No `<img` leakage.** Every image goes through `next/image` or `ResilientImage` — no bypass.
- **Cache is tiered.** Product/brand/fonts are immutable (content-hashable webp), campaign imagery is revalidatable — matches the edit cadence.
- **Preview OOM guard.** `unoptimized` in preview/CI prevents the on-demand optimizer from SIGABRT-ing a memory-limited `next start` on image-heavy shop pages.

### Gaps

| Gap | Severity | Detail |
|---|---|---|
| **`remotePatterns` is narrow (3 hosts)** | LOW | Only S3 (Square), Squarespace, and `*.printful.com`. If a future provider (e.g., Shopify CDN for a collab SKU) is added, builds will fail with "hostname not configured" — by design, but the error is opaque to a non-engineer running `product-factory`. Add a comment listing the approved hosts and the retry path. |
| **No explicit `priority` on the hero LCP** | LOW-MEDIUM | `app/page.tsx` hero and `app/product/[slug]/page.tsx` gallery root should carry `priority` (with `fetchPriority="high"`) to hit LCP ≤2.5s. `ResilientImage` supports it; grep suggests it is not consistently set. Verify with Lighthouse `lighthouse.yml` (currently budgets LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 on `/` only). Extend Lighthouse to `/product/[slug]` and `/shop`. |
| **`public/products/` webp is not AVIF** | INFO | Source files are webp; the Next optimizer transcodes to AVIF on the fly. This is correct — storing AVIF originals would be larger for the optimizer to decode first. Not a gap, but worth noting so a future asset pass does not "fix" it by re-encoding to AVIF at rest. |
| **`deviceSizes` missing 2560** | INFO | Largest is 1920. On a 27" desktop with `devicePixelRatio=2`, a full-bleed lookbook image could request 3840. The config comment says 3840 is avoided as a fallback — correct, but a 2560 entry would serve that case without the 3840 penalty. Monitor CLS/LCP on large viewports. |

**Verdict:** **E-commerce grade.** The LCP/fade/cache tiering is ahead of most boutique storefronts.

---

## 7 — Security headers / CSP

### Evidence

`next.config.mjs:headers()` for `/(.*)`:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy:
  default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';
  form-action 'self';
  script-src 'self' 'unsafe-inline' (+ 'unsafe-eval' in dev) https://web.squarecdn.com (+ sandbox)
               https://pay.google.com https://www.googletagmanager.com
               https://connect.facebook.net https://analytics.tiktok.com
  style-src  'self' 'unsafe-inline' https://web.squarecdn.com
  img-src    'self' data: blob: https://items-images-production… https://images.squarespace-cdn.com
             https://*.printful.com https://*.squarecdn.com https://www.googletagmanager.com
             https://www.google-analytics.com https://*.google-analytics.com
             https://www.facebook.com https://analytics.tiktok.com
  font-src   'self' data: https://*.squarecdn.com https://cash-f.squarecdn.com
             https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net
  connect-src 'self' https://web.squarecdn.com https://pci-connect.squareup.com (+ sandbox)
              https://pay.google.com https://google.com https://www.google.com
              https://www.googletagmanager.com https://www.google-analytics.com
              https://*.google-analytics.com https://*.analytics.google.com
              https://connect.facebook.net https://www.facebook.com
              https://analytics.tiktok.com https://*.tiktok.com https://api.zippopotam.us
  frame-src  'self' https://web.squarecdn.com https://*.squarecdn.com
             https://pay.google.com https://appleid.apple.com https://*.cardinalcommerce.com
  worker-src 'self' blob:; manifest-src 'self'
```

Plus: `lib/security/rate-limit.ts`, `lib/security/cron-guard.ts`, `lib/square/webhooks.ts`, `lib/printful/webhooks.ts`, `lib/ops/auth.ts` (ops auth), `public/_headers` (static caching), `public/sw.js` (navigation-only, no price/cart caching).

### Strengths

- **Headers are complete.** The 6 canonical hardening headers are all present and correctly valued. `frame-ancestors 'none'` + `X-Frame-Options: DENY` is redundant in the right direction.
- **CSP is provider-accurate.** Square sandbox hosts are **conditionally stripped in production** (`isSquareProduction` checks `SQUARE_ENVIRONMENT === "production"` — note the deliberate `|| "production"` avoidance so an unset env keeps the sandbox allows). `https://www.google.com` is included for the Google Pay manifest (without it `googlePay()` throws a CSP violation) — the comment cites the exact failure. No Sentry host (correctly — there is no Sentry code).
- **Webhook HMAC is timing-safe.** Both verifiers use `crypto.timingSafeEqual` with length check — not `===`.
- **Cron is double-gated.** `isScheduledInvocation` admits only Netlify's documented `next_run` POST body *or* a `CRON_SECRET` bearer — the Netlify scheduler contract is cited.
- **Service worker is commerce-safe.** `public/sw.js` caches only `offline.html` and only for `mode: navigate`; assets and API are never cached (stale price is dishonest). Web-push is opt-in only.

### Gaps

| Gap | Severity | Detail |
|---|---|---|
| **`unsafe-inline` for `script-src` + `style-src`** | LOW-MEDIUM (accepted) | Required by Next's inline scripts/styles and Square SDK injection. The alternative is `nonce`/`hash` per-request CSP — Next supports it via `headers()` + `nonce` in `next.config`, but it requires `middleware.ts` to mint a nonce per response. The current posture is standard for Next + Square; moving to nonce would be a Tier 2 hardening pass. |
| **`unsafe-eval` in development** | INFO | Gated behind `isDevelopment` — correct. No risk to production. |
| **HSTS missing `preload`** | LOW | `max-age=31536000; includeSubDomains` but no `preload`. To preload, the apex must be `https` everywhere (it is) and submit to `hstspreload.org`. Add only when the www→apex 301 is verified permanent. |
| **No `report-uri` / `report-to`** | LOW | CSP violations are silent. Adding `report-uri` (or `report-to` with `Report-To` header) would surface a Square SDK or GTM misconfiguration before a shopper does. |
| **CSP allowlist is wide** | INFO | `connect-src` allows `googletagmanager`, `google-analytics`, `facebook`, `tiktok`, `zippopotam`. Each is justified (analytics, pixels, address lookup), but every additional origin is a bypass if compromised. Re-audit whenever a pixel is added — the current set is documented in the CSP comment, which is the right control. |
| **Rate limit is not durable** | LOW-MEDIUM | As in §5 — per-instance `Map` does not bound cross-instance bursts. For `feedback` and `magic-link` this is fine (abuse is low-value); for a future high-value endpoint it would not be. |
| **No `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`** | INFO | Not needed for this storefront (no cross-origin isolation requirement, Square/Apple Pay iframes would break under `COEP: require-corp`). Correctly omitted. |

**Verdict:** **Strong.** The CSP is one of the more careful boutique implementations — sandbox-conditional, failure-cited, and not copy-pasted.

---

## 8 — Docs / AGENTS

### Evidence

- `AGENTS.md` (3096 B): canonical checkout, GitHub, Netlify site `275b4115-…`, `SOURCE_OF_TRUTH.md` as mandatory startup read, `pwd -P` / `git status` preamble, safety boundaries (never live-checkout, never touch `.env*`/DNS/fulfillment without scoped auth), `npm run {lint,typecheck,test,validate:all,build,verify:*}` command set, on-demand references (`AHA-DESIGN-SYSTEM.md`, `OPERATIONS-HANDBOOK.md`, `product-factory.md`), completion contract.
- `CLAUDE.md` (698 B): adapter that defers to `AGENTS.md` + `SOURCE_OF_TRUTH.md`.
- `SOURCE_OF_TRUTH.md` (5705 B): verified 2026-07-31 from Git/GitHub/Netlify API/HTTPS — canonical checkout, `main` branch, deploy ID `6a67989`, commit `6194668`, live root SHA-256, www→apex 301, build/publish, safety, verification rails, `[skip netlify]` deployment caveat.
- `.impeccable.md` (751 B): geometric editorial direction, brand dials (`DESIGN_VARIANCE:7`, `MOTION_INTENSITY:4`, `VISUAL_DENSITY:5`).
- `README.md`: mirrors AGENTS with layout map.
- `docs/`: `AHA-DESIGN-SYSTEM.md`, `OPERATIONS-HANDBOOK.md`, `commerce-operations.md`, `product-factory.md`, `design-tokens.md`, `FRICTIONLESS-COMMERCE-PLAN.md`, `DISTRIBUTION.md`, `docs/audits/` (10 audits: accessibility, asset, commerce, component, design-gap, performance, QA, route, SEO, system), `docs/plans/`.

### Strengths

- **Two-file startup contract.** `AGENTS.md` + `SOURCE_OF_TRUTH.md` let a fresh agent (or auditor) prove the deploy ID, source commit, domains, and live fingerprint without reading 73k of master handoff. The previous wrong-site deployment is explicitly guarded by `verify:netlify-site/live`.
- **Safety boundaries are specific.** "Protect Cart→Checkout→Payment→Confirmation above all" plus the exact high-risk globs (`lib/square/`, `lib/printful/`, `lib/commerce/`, `app/api/`, cart, checkout, webhooks, ops) — not generic "be careful."
- **Historical docs are quarantined.** `MASTER-BUILD-INSTRUCTION.md` (43k) + `MASTER-UIUX-HANDOFF-v2.md` (73k) are present but AGENTS labels them "historical references, not mandatory startup context." This prevents handoff drift (the classic boutique failure where an old SKU list is treated as truth).
- **Commerce operations are owned.** `OPERATIONS-HANDBOOK.md` + `commerce-operations.md` + `netlify-commerce-backend-readiness.md` give a runbook for fulfillment-state, reconciliation, and provider health.

### Gaps

| Gap | Severity | Detail |
|---|---|---|
| **`SOURCE_OF_TRUTH.md` is 9 days stale** | LOW | `Last verified: July 31` at audit time (Aug 06). The deploy ID/commit/fingerprint fields are durable but the lag means a doc-only push (`6f36aea [skip netlify]`) after the last verification is not reflected. Re-verify and bump the date after each production deploy — the file itself says to. |
| **`docs/` historical weight** | INFO | 29 files, two >40k. Search still works, but a new contributor can open `MASTER-UIUX-HANDOFF-v2.md` and re-propose retired routes (`/collections/[slug]`, `/drops`) that `next.config.mjs` deliberately 308s. The quarantine comment mitigates, but a `docs/README.md` index with "current vs historical" would be clearer. |
| **No `CONTRIBUTING.md` / `SECURITY.md`** | INFO | Standard GitHub surfaces. `security.yml` (gitleaks) exists, but a `SECURITY.md` with the responsible-disclosure path and the "never live-checkout" rule would help external reviewers. |

**Verdict:** **Exemplary for a boutique.** Most 2-person labels have no AGENTS contract at all; this one is operable.

---

## 9 — Cross-cutting findings

### Build & deploy

- `netlify.toml`: `command = npm run build`, `publish = .next`, `NODE_VERSION=20`, `NEXT_PUBLIC_SITE_URL=https://afterhoursagenda.com`, `SQUARE_API_VERSION=2024-01-18`, secrets-scan allowlist correct, `@netlify/plugin-nextjs` plumbed. All contexts (`production`/`staging`/`deploy-preview`/`branch-deploy`) have explicit `SQUARE_ENVIRONMENT` + `AHA_PREVIEW_CATALOG` + `AHA_FULFILLMENT_MODE` — no ambient default.
- `next.config.mjs`: `poweredByHeader: false` (correct), `htmlLimitedBots: /.*/` (keeps metadata in `<head>` for crawlers under Netlify streaming), `images.unoptimized` preview guard, `redirects()` permanent/temporary split, `headers()` caching tiers.
- **Gap:** `NODE_VERSION=20` vs local `22.22.3` vs `@types/node@25` — align to one LTS (recommend 22, since Netlify supports it and local is already 22).

### SEO / social / PWA

- `app/sitemap.ts` — static pages (weekly/monthly) + dynamic `getAllProducts()` entries, **no fake `lastmod`** (comment explains why `new Date()` was removed). `app/robots.ts` — dual-host logic (Netlify subdomain → `Disallow: /` but still advertises canonical `host`), `Allow` list is deliberate (cart/checkout are `noindex` in page metadata, not `Disallow` — correct or Google never reads the `noindex`). `app/layout.tsx` — `openGraph.url` intentionally omitted at root so child pages do not inherit the homepage URL; `metadataBase` is `NEXT_PUBLIC_SITE_URL`. `app/manifest.ts` + `public/sw.js` + `public/brand/icons/*` — PWA complete.
- **Strength:** The sitemap/robots comments are unusually honest about the trade-offs (e.g., why `og:url` is not at root, why `lastmod` is omitted). This prevents a future SEO "fix" from reintroducing a known-bad pattern.

### Accessibility & theming

- `tailwind.config.js` tokens are semantic (`void`/`cream` naming debt is documented with the 484-site audit note), `hoverOnlyWhenSupported: true`, `fontSize`/`letterSpacing` named scales, `transitionDuration`/`transitionTimingFunction` wired to `globals.css` motion tokens (`--aha-motion-*`, `--aha-ease-*`) with `motion-reduce:transition-none` respected in `ResilientImage`.
- `app/globals.css` — light `color-scheme` only, WCAG AA tokens (`--aha-accent #CE3D56` 4.55:1 on paper, `--c-accent-on-sunken #B8304A` 5.2:1, `--aha-success #166534` 6:1), `viewport.themeColor` brand-rose.
- **Gap:** No `eslint-plugin-jsx-a11y` rule surface beyond `next/core-web-vitals` (e.g., no `no-noninteractive-element-interactions` enforcement). The component code compensates, but it is not gated.

---

## 10 — Risk matrix (fix vs. schedule vs. accept)

| # | Finding | Risk if ignored | Effort | Recommendation |
|---|---|---|---|---|
| R1 | `react` 18 + `@types/react` 19 skew | Types lie; a React 19 API could be used and pass `tsc` but fail at runtime | Large (branch + QA) | **Schedule** — dedicated `react-19` branch, full checkout regression. Do not patch. |
| R2 | Tailwind 3 vs 4 | Increasing drift from ecosystem plugins/templates | Large (migration) | **Schedule** with R1 as a joint "framework rotation" quarter. |
| R3 | No tagged e2e for `@cart`/`@checkout` | Highest-value flow has no automated gate | Medium (write specs) | **Fix next** — add Playwright specs for add→cart→quote→`create-payment` (mock Square) + `order-confirmed`. |
| R4 | `@neondatabase/serverless` 0.10→1.1 | Driver bug surface on edge | Small | **Fix next** — bump + `npm test` + smoke `db:generate`. |
| R5 | ESLint 8→9 + flat config | Future `eslint-config-next` will require it | Small-Medium | **Schedule** with R1/R2. |
| R6 | `noUncheckedIndexedAccess` off | Map-lookup `undefined` can slip past `tsc` | Tiny | **Fix next** — one-line `tsconfig.json` addition; will surface a handful of `| undefined` to handle. |
| R7 | `node_modules` absent at audit | CI is green 9 days ago but local tree not re-verified | Tiny | **Fix now** — `npm ci && npm run lint && npm run typecheck && npm test && npm run validate:all && npm run build`. |
| R8 | HSTS no `preload`, CSP no `report-uri` | Missed hardening signal | Tiny | **Schedule** — add `report-uri` first (observability), `preload` after www→apex permanence confirmed. |

---

## 11 — What to do next (no code changed in this audit)

1. **Re-verify the verification rail** — `npm ci && npm run verify:netlify-site && npm run verify:commerce-readiness:netlify` and bump `SOURCE_OF_TRUTH.md:Last verified` (it is 9 days old).
2. **Run the full gate** — `npm run lint && npm run typecheck && npm test && npm run validate:all && npm run build` (local `node v22.22.3` — align `netlify.toml:NODE_VERSION` to `22` or pin `@types/node` to `20` first).
3. **Add the two missing e2e specs** — `@cart` and `@checkout` tagged Playwright flows; remove the `--pass-with-no-tests` crutch for those tags once they exist.
4. **Open a `chore/framework-rotation` branch** for R1+R2+R5+R4 together — not on `main`, not under a `[skip netlify]` doc commit.
5. **One-line `tsconfig.json` hardening** — `"noUncheckedIndexedAccess": true` (and optionally `"target": "ES2022"`).

---

## 12 — File inventory (what was read)

`package.json`, `package-lock.json`, `tsconfig.json`, `next.config.mjs`, `netlify.toml`, `tailwind.config.js`, `postcss.config.js`, `.eslintrc.json`, `knip.jsonc`, `playwright.config.ts`, `vitest.config.ts`, `drizzle.config.ts`, `db/schema.ts`, `app/layout.tsx`, `app/globals.css`, `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`, `app/page.tsx`, `app/product/[slug]/page.tsx`, `components/ui/ResilientImage.tsx`, `components/seo/buildMetadata.ts`, `lib/square/client.ts`, `lib/square/catalog.ts`, `lib/square/webhooks.ts`, `lib/printful/client.ts`, `lib/printful/webhooks.ts`, `lib/commerce/runtime.ts`, `lib/commerce/fulfillment.ts`, `lib/commerce/orders.ts`, `lib/data/products.ts`, `lib/security/rate-limit.ts`, `lib/security/cron-guard.ts`, `app/api/create-payment/route.ts`, `app/api/checkout/route.ts`, `public/sw.js`, `public/_headers`, `.github/workflows/*.yml` (6), `AGENTS.md`, `CLAUDE.md`, `SOURCE_OF_TRUTH.md`, `.impeccable.md`, `README.md`, `docs/` (29 files).

---

*Generated read-only. No files were mutated except this audit report. Re-run with `npm ci` present to include live lint/typecheck/test/build output.*
