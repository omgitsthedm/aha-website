# AHA — After Hours Agenda — PROJECT STATUS (cold-start entry point)

> **Read this first.** If you are a person or an AI agent picking this up cold, this file tells you what After Hours Agenda is, exactly where it stands, what to do next, and where everything lives. One screen to orientation.
>
> **Last updated:** 2026-07-16 · **Updated by:** Claude Code (LiFi NYC) · **Stage:** LIVE production e-commerce (real domain, real payments wired)

---

## 1. What it is
After Hours Agenda (AHA) is a **live NYC streetwear e-commerce store** at https://afterhoursagenda.com — a Next.js 15 storefront on Netlify with **Square** for payments/orders and **Printful (print-on-demand)** for catalog and fulfillment. This is real production commerce, not a demo or staging site. Runs under Little Fight NYC (project code LFNYC-AHA). Customer-facing name is always the full "After Hours Agenda"; "AHA" is internal-only.

## 2. Current state (2026-07-16)
- **Status:** ✅ LIVE and Git-backed. Storefront, catalog, cart, checkout, webhooks, order ops, and email are deployed. Automatic Printful fulfillment after verified Square payment is **enabled in production** — but **no real customer order has been observed end-to-end yet** (the one true "medium confidence / TBD" item).
- **Live URL:** https://afterhoursagenda.com/ — **200 OK, verified 2026-07-16**. `www` 301-redirects to apex.
- **Git:** clean working tree, up to date with `origin/main` (0 uncommitted before this doc, 0 ahead/behind). Last commit `bff18ac` 2026-07-15 — "docs(state): record rose browser-chrome theme-color".
- **Branch:** `main` (canonical + production deploy branch).
- **Design system (current):** Origami Geométrico on a **LIGHT ground** — Paper White `#FAFAFA`, Ink `#1A1A1A`, rose actions `#FF6B6B` (rose *text* uses `#CE3D56` for AA contrast). The old ink-black era is retired. ⚠️ Browser/tab chrome (theme-color) is intentionally **rose `#FF6B6B`**, not paper — do NOT "fix" it back. (Note: project memory refers to "inverted" token names void=paper/cream=ink; the repo's current `docs/AHA-DESIGN-SYSTEM.md` is the authority.)
- **Catalog:** Per the newest STATE block (2026-07-14): ~122 buyable products live with real-model campaign photography. A pilot allowlist (`lib/data/pilot-assortment.ts`) can filter the public assortment; historical catalog remains connected to the backend but filtered from public lookups. **Verify current live assortment before assuming.**
- **Analytics gap (2026-07-14):** `trackCommerceEvent` pushes to `dataLayer` but **no GA4/GTM script is loaded** — funnel events go nowhere until a measurement id is supplied.

## 3. Where everything lives
| Thing | Location |
|---|---|
| **Canonical code** | `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/aha-website` — real git clone at the AHA folder root. Edit + push from here. (`Website/aha-website` is a back-compat symlink to this same dir.) |
| **GitHub** | `github.com/omgitsthedm/aha-website` (branch `main` is canonical) |
| **Hosting** | Netlify project `afterhoursagenda`, site id `275b4115-16bf-42fb-9b36-6bce9bb93608` → https://afterhoursagenda.netlify.app → https://afterhoursagenda.com |
| **Database** | Managed **Netlify Database (Neon)** via `NETLIFY_DB_URL` runtime binding; migrations current |
| **Payments / fulfillment** | Square (payments/orders, app id `sq0idp-…`, location `FGKRPYEXNV482`) + Printful v2 beta (store `14298228`) |
| **Email** | Resend outbox, sender `orders@afterhoursagenda.com`, domain verified (per STATE 2026-07-11) |
| **Design / handoff material** | `docs/` in-repo (see §8) + brand assets under the parent `After Hours Agenda/` folder (`Brand/`, `Logos/`, `Products/`) |
| **Secrets** | Netlify env vars + Keychain/password manager only. `.env*` are gitignored — never inspect or commit. Name-only readiness checks are allowed. |

> ⚠️ **Two-clone situation (investigated 2026-07-16):** This Desktop clone is the **ONLY active working clone and is canonical** (git remote `omgitsthedm/aha-website`, branch `main`, clean, synced with origin, last commit 2026-07-15, matches the live site). The `~/Code/LiFi NYC/Clients/` tree — which older project memory called the "stale ~/Code clone" — **no longer contains an aha-website clone at all** (it has other clients, but no After Hours Agenda). The only other copy on disk is a **retired iCloud backup** at `~/Documents/Home Folder Cleanup 2026-06-30/Retired iCloud Copies/…/aha-website` on branch `backup/consolidation-20260629` (last commit 2026-06-30, "no deploy, no main push") — it is **OFF-LIMITS; do not touch**. (`~/.squirrel/projects/aha-website` is just the squirrelscan audit DB, not a clone.)

## 4. What's done
Full live commerce stack: Next.js 15 App Router storefront (home/shop/product/collections/bag/checkout + About, Lookbook, legal), Square checkout, Printful v2 catalog + fulfillment routing (`lib/commerce/fulfillment-state.ts` routes catalog-only batches → v2, any-sync batches → v1), signature-verifying + deduping Square/Printful webhooks persisting to Netlify Database, automatic Printful confirmation after verified Square payment (with duplicate-safe provider-id persistence + safe retries), protected `/ops` dashboard, guest `/track-order`, 15-min scheduled reconciliation, Resend transactional email (order/production/exception/shipping templates, domain verified), product factory (`scripts/product-factory.mjs`), PWA install/offline/web-push ship alerts/haptics/share, and CI gates (typecheck, lint zero-warnings, vitest, Playwright E2E, Lighthouse, security). DNS cutover complete (Cloudflare NS → Netlify apex; Google Workspace MX preserved). Non-Git production deploys are blocked at Netlify.

## 5. What's next (immediate)
From `.ai/STATE.md` (Next Steps / QA-PENDING):
- **Observe the first real organic paid order** end-to-end (Square → DB → Printful confirm → outbox → shipment webhook) and inspect any exception in `/ops`. **Do NOT fabricate a customer payment.**
- Add **real Square Sandbox credentials** scoped to deploy previews/staging; create + get approval for a **sandbox checkout test plan**, then a **David-approved live safe-path** before any live payment test.
- Wire **GA4/GTM measurement id** so `trackCommerceEvent` funnel events land somewhere.
- Confirm/align the **Square webhook notification URL** to the exact non-redirecting URL Square posts to (env currently references a `www.` URL that 301s — signature verification needs an exact match). See SOURCE_OF_TRUTH.md "Active Caveats".
- Decide whether AHA needs `.ai/RELEASES.md` for drop/product history.
- Next.js/PostCSS dependency advisories: npm's auto-fix is a breaking upgrade to `next@16.2.10` — handle as a separate framework migration with Netlify compat review.
- Continue building the collection/imagery/copy inside the Origami system in `docs/AHA-DESIGN-SYSTEM.md`.

## 6. How to run / build / deploy
```bash
cd "/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/aha-website"
npm install
npm run dev            # next dev (local)
npm run build          # next build (run locally before every push)
npm run lint           # eslint --max-warnings=0
npm run typecheck      # tsc --noEmit
npm test               # vitest
npm run validate:all   # products + Square map + Printful v2 map + margin check
# Pre/post-deploy guards (NEVER deploy by site name alone):
npm run verify:netlify-site               # exact-site target guard
npm run verify:commerce-readiness:netlify # env-name readiness (values not printed)
npm run verify:netlify-live               # live guard (.netlify.app + apex)
# Deploy path: push reviewed main → Netlify Git-backed production deploy.
# Avoid manual prod deploys except a scoped emergency restore.
```

## 7. Non-negotiable boundaries (do not break)
- **Never break Cart → Checkout → Payment → Confirmation.** Extreme care on `lib/square/`, `lib/printful/`, `lib/commerce/`, `app/api/`, `app/cart/`, `components/checkout/`.
- **Never hardcode** prices, product IDs, or inventory — always pull live from Square/Printful. Square = source of truth for payments/orders; Printful = source of truth for catalog/variants/mockups/shipping.
- **No secrets in code or docs.** `.env*` gitignored — do not inspect or commit. (Public identifiers like `NEXT_PUBLIC_SQUARE_APP_ID`/`PRINTFUL_STORE_ID`/`SQUARE_LOCATION_ID` are the exception and are allow-listed in `SECRETS_SCAN_OMIT_KEYS`.)
- **Do NOT deploy by site name alone.** Run the exact-site guard first; run the live guard after; keep non-Git prod deploys blocked.
- **Do not touch without scoped confirmation** (from `.ai/STATE.md`): `.env*`, `PRODUCT_CATALOG.json`, `REORGANIZATION_LOG.csv`, live checkout/payment/order/customer/fulfillment data, Square/Printful production settings, DNS records, Netlify production deploy settings, live analytics/pixels.
- **Do not fabricate a customer payment/order.** Live fulfillment flags (`AHA_FULFILLMENT_MODE=auto`, `PRINTFUL_ALLOW_CONFIRM_ORDERS=true`, `PRINTFUL_LIVE_MODE=true`) are ON in production only.
- **Do not restore** retired historical products/collections or retired brand vocabulary (`Black Sheep Newsstand`, `design index`, `active archive`, `drop bulletin`, `Outside Hours`, etc.) or the rejected PR #12 content direction.
- **Never touch the retired iCloud backup clone.** Canonical work happens only in this Desktop clone.

## 8. Deeper docs (read in this order)
`SOURCE_OF_TRUTH.md` → `.ai/STATE.md` (current live truth + session history) → `CLAUDE.md` (repo rules + §47 build doctrine) → `docs/OPERATIONS-HANDBOOK.md` → `docs/AHA-DESIGN-SYSTEM.md` (controlling visual system) → `docs/MASTER-BUILD-INSTRUCTION.md` + `docs/MASTER-UIUX-HANDOFF-v2.md` (governing build/UX doctrine) → `docs/product-factory.md` (adding products) → `docs/commerce-operations.md` / `docs/netlify-commerce-backend-readiness.md` → `docs/AUDIT-FLAGSHIP-HARDENING-2026-07-11.md`.
