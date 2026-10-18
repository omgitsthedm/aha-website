# After Hours Agenda operating contract

This is the current operating contract. It replaces dated launch narratives and does not itself authorize production writes, provider changes, payments, customer messages, ad spend, or publishing.

## Source, application, and release

- Work in the current isolated task checkout only when assigned. The primary working clone is `/Users/davidmarsh/Code/LiFi NYC/Clients/After Hours Agenda/aha-website`; the registered push checkout is `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website`. Preserve its branch and use it only for the guarded fetch-and-push path when a separately authorized release requires it.
- The active application is `site-preview/` (Astro). The repository-root Next.js application is historical source and must not be reactivated for storefront or checkout work.
- Repository: `omgitsthedm/aha-website`; production branch: `main`. The exact Netlify site is `275b4115-16bf-42fb-9b36-6bce9bb93608` at `https://afterhoursagenda.com`.
- Read `SOURCE_OF_TRUTH.md` for the dated verification snapshot and remaining work. Confirm future live claims from the exact published deploy, matching `/release.json`, and GitHub `main`; a local build, merge, branch, or document is not release proof.
- New changes are preview-first. Finish implementation, Node 24 checks, and local visual review before a hosted preview or release. Do not publish, push, commit, or deploy unless the task explicitly authorizes it.

## Brand, customer content, and creative assets

- The customer-facing business is **After Hours Agenda**. Do not substitute agency/client identities, invented city-origin claims, other businesses' details, or unsupported social channels. There is no TikTok work or account in scope.
- Preserve the established paper/ink/rose system, Poppins 400/700/900, JetBrains Mono, black-sheep mark, hairline frames, and warm plain clothing-brand voice. Customer copy may not make puns on the brand name, night/time of day, or “agenda.”
- Shopping images are garment-only; campaign/editorial images remain separate. Campaign imagery is torso-only with no faces and no readable text except a garment’s own graphic (generic environmental signs allowed). Keep accurate AI/archive/provider labels and IPTC AI metadata where supplied.
- The collection films use licensed Pexels city footage and locally generated torso garment clips. Keep the photo as the primary image, reduced-motion/data-saver safeguards, pause control, and real/AI caption. Recheck new garment frames for faces. The Fall 2026 advert and its YouTube-sourced footage/commercial music are not publishable.

## Catalog, checkout, fulfillment, and tracking safeguards

- Product, price, mapping, and availability changes go through `site-preview/tools/catalog` and `site-preview/catalog/ledger.json`; never use ad-hoc provider writes. Read `.agents/skills/aha-catalog/SKILL.md` for that workflow. Generated fulfillment catalog code must remain generated from the ledger. Preserve static/runtime product-page and feed parity.
- Keep exact Square-to-Apliiq mappings, allow lists, private label `SB-3-161622`, and the additive matching migration rule in both root and active-package Netlify migration paths. Do not blindly retry a provider submission.
- The active checkout is the Astro storefront’s persistent bag and embedded Square checkout. Server-owned quotes validate approved variants and current pricing; durable sessions prevent payment-token replay. Signed Square callbacks and the fulfillment hold protect paid-order routing to Apliiq. Never create, fabricate, refund, or fulfill an order/payment/customer as a test.
- Preserve current prices, sizes, free domestic shipping, supported international rates, tax rules, and existing-order terms unless the user authorizes a change. Keep provider identifiers and store identity in `site-preview/client.config.json` and the catalog ledger.
- Existing automated confirmation and shipment notifications may continue for verified real orders. No paid test purchase, sample, ad spend, manual customer message, newsletter send, or new subscription is authorized by this contract. Development verification must not send transactional email. Use Square Sandbox only for non-billable verification when credentials and task scope permit.
- Tracking is default-on with no automatic cookie banner. Footer Privacy choices provide opt-outs; Global Privacy Control disables Meta marketing. Exclude direct customer details and emit purchases only after verified payment, never from a return URL or checkout click.

## Security and validation

- Keep credentials in approved private settings only. Never print, commit, publish, or place secrets in fixtures; preserve existing provider accounts, payment history, fulfillment contracts, database data, and customer data.
- Treat checkout, webhooks, provider mappings, fulfillment, migrations, and database operations as high risk. Preserve root and `site-preview/` Netlify configurations together when a task legitimately changes release behavior.
- From `site-preview/` on Node `24.21.0`, run the relevant `npm run check`, targeted tests, `npm run test:e2e`, `npm audit`, build, and local visual checks before an authorized deploy. Validate actual coverage and do not claim a paid-production round trip from a sandbox or browser check.
