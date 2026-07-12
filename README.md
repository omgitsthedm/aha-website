# After Hours Agenda — Storefront

Premium DTC clothing-brand ecommerce. **Live:** https://afterhoursagenda.com

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · GSAP · Netlify · **Square** (payments) · **Printful API v2 beta** (fulfillment) · Netlify DB / Neon (operational data).

## Doctrine (read before building)
1. `docs/MASTER-UIUX-HANDOFF-v2.md` — controlling UI/UX/product doctrine.
2. `docs/MASTER-BUILD-INSTRUCTION.md` — full ecommerce build spec.
3. `CLAUDE.md` — repo rules (protect the purchase flow above all).
4. `SOURCE_OF_TRUTH.md` / `.ai/STATE.md` — live production truth + current state.

## Commands
```bash
npm run dev            # local dev
npm run build          # production build (run before pushing)
npm run typecheck      # tsc --noEmit
npm run lint
npm test               # vitest unit tests
npm run test:e2e       # Playwright (Sandbox)
npm run validate:all   # product + square-map + printful-v2-map + margin gates
npm run db:migrate     # apply db/migrations (needs DATABASE_URL)
# Deploy is Git-backed: merge to main → Netlify. Guards:
npm run verify:netlify-site        # exact target site id
npm run verify:netlify-live        # live serves AHA content
npm run verify:commerce-readiness:netlify
```

Production operations: `/ops` (credential retrieval and runbook: `docs/commerce-operations.md`). Customer order status: `/track-order`.

## Structure
```
app/            App Router pages + api routes (checkout, webhooks, commerce/readiness)
components/     cart · checkout · homepage · product · seo · shop · ui
lib/            square/ · printful/ (v2) · commerce/ · data/ (loader + purchasable gate) · db/ · types/
data/           product-manifest.json + square-map / printful-v2-map / size-guides (internal product layer)
scripts/        validate-* + margin-check + db-migrate (tsx)
db/migrations/  Postgres schema (§14)
docs/           doctrine + build docs + design tokens + ci/branch-protection
.github/workflows/  ci · e2e · lighthouse · security · release
ops/            netlify target guard + commerce-readiness
```

## Non-negotiables
No unmapped product purchasable · no Printful fulfillment before Square payment success · no live Printful confirm outside production flags · Square SDK only on checkout · never expose/commit Square/Printful secrets · no fake urgency/scarcity/reviews/hidden costs · WCAG 2.2 AA · mobile-first.

## Build status
Phase 1 (foundation) landed: env/Netlify contexts, design tokens, internal product model + validation harness, DB schema/migrations, CI gates + tests, docs. **Phases 2-6 (storefront, commerce backend, Printful v2 fulfillment, brand systems, launch) in progress** — see `.ai/STATE.md` and `docs/MASTER-BUILD-INSTRUCTION.md §46`.

## Every session ends with
what changed · files touched · tests run · risks · remaining gaps · next recommended step.
