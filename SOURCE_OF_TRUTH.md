# After Hours Agenda source of truth

## Current architecture — October 15, 2026

The active application is `site-preview/` (Astro static storefront plus scoped Netlify Functions), selected by both Netlify configurations. The original root Next.js checkout/provider code is preserved historical source and is not deployed. Required CI, browser flows, dependency auditing and Lighthouse now run against the active package. Do not reactivate the root application to repair current checkout.

The current release implements one persistent size-and-quantity bag and embedded Square Web Payments checkout. Server-owned quotes validate the 13 approved variants, prices, shipping and the existing Arizona tax rule. Durable checkout sessions bind one order/payment and recover ambiguous responses without replaying a source token. Current signed Square fulfillment callbacks continue to route eligible paid orders to Apliiq; the active transactional outbox supplies confirmation and shipment emails. New migrations must match byte-for-byte in the repository-root and active-package migration directories. Only production/functions-scoped settings for exact site `275b4115-16bf-42fb-9b36-6bce9bb93608` can enable this runtime.

Square Sandbox is used for non-billable payment verification. Production verification stops before a paid purchase. Publication is proven by the published Netlify deploy and `/release.json`, not this document.


## Current storefront release — October 14, 2026

The owner authorized reopening commerce for two Bone Yikes! products, then upgraded Apliiq to VIP and authorized automatic fulfillment. Current implementation is `site-preview/`; the API release branch is `launch/apliiq-fulfillment-2026-10-14`. The canonical asset package is `/Users/davidmarsh/Desktop/After Hours Agenda/00 Current Drop — Fall 2026/05 Product Run — October 14`. Before the API release, GitHub main is `8083759109a0ecb83c6a1db3a62c2240f1917d56` and the exact Netlify site's published deploy is `6ad03b4a097c2b8bd6b02266`. These are dated checkpoints, not proof that the API release has published.

The storefront links to Square-hosted checkout, supplies 13 current size variants to Google/Meta feeds, and uses GA4 and Meta browser events by default for new visitors. The footer Privacy choices retain explicit opt-outs, and Global Privacy Control blocks Meta marketing; events exclude direct customer details. This owner-directed October 15 policy supersedes earlier consent-gated wording, which remains historical evidence below. The original Next.js commerce/provider APIs remain inactive and preserved. The new scoped fulfillment functions live under `site-preview/netlify/functions/`, with durable order and event state in additive Netlify Database tables. Confirm publication, required production settings, the signed Square subscription and authenticated health before claiming automated fulfillment is live. See `LAUNCH-2026-10-14.md` for current product, tracking, validation and remaining operational details. The paused-commerce and preview-only statements below describe the previous October 9 release.

Verified October 9, 2026 from Git, the exact Netlify site, public release markers and browser checks. Provider data was not queried or changed.

## Identity

After Hours Agenda stays After Hours Agenda. It owns the custom-domain project at `afterhoursagenda.com`. The latest user instruction supersedes the initial LFNYC rebrand brief. No other business's marks, services, contact details or case studies belong in the active preview.

## Source and pre-release production receipt

- Original checkout: `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website`.
- Original local branch/head preserved: `release/seo-domination-2026-10-08`, `095d5884e720d66e659f3676187e028deecbb84e`.
- GitHub: `https://github.com/omgitsthedm/aha-website`; production branch `main`.
- Production source before the October 9 approved release: `c682761ef26bbedb4ea4f76fc869e7ded883a12d`.
- Exact Netlify site ID: `275b4115-16bf-42fb-9b36-6bce9bb93608`, project `afterhoursagenda`.
- Production deploy before the October 9 approved release: `6ac793e13b19850008db4a3a`, published October 8, 2026.
- Primary host: `https://afterhoursagenda.com`; public marker `/release.json`.
- Root application: Next.js 16.4.0 / React 19.2.8, with existing commerce/provider infrastructure. Root `netlify.toml` selects the new static package; the selected `site-preview/netlify.toml` must contain matching production contexts. The original application is preserved, not the new production build target.

These are dated receipts, not permission for future production writes. Recheck before release.

## Active review

- Worktree: `/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/worktree`.
- Branch: `audit/2026-10-09`.
- New application: `site-preview/`, Astro 7.3.8 / Node 24.21.0 / supported TypeScript 6.0.3.
- Review alias: `https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app`. Retained technical alias replaces the initial draft in place; it does not name the site's brand.
- The final draft ID, exact source and digest belong in `AUDIT-REPORT.md` and deployed `release.json`.
- Static artifact only; no functions, database migration, checkout, provider request, tracker, newsletter submission or automated order lookup.
- Contact drafts go only to `info@afterhoursagenda.com` when a visitor chooses to send from their own email app.
- Both HTML and HTTP carry noindex. The preview remains publicly reachable; no authentication is claimed.

## Brand and content authority

Current `app/globals.css`, `app/layout.tsx`, `lib/content/brand-copy.ts`, `components/ui/SheepMark.tsx` and `data/brand-imagery.json` resolve conflicts in older design documentation. Preserve paper white, ink, rose, Poppins 400/700/900, JetBrains Mono, the black-sheep mark, plain hairline frames and the warm clothing-brand voice. Do not adopt obsolete city-origin claims or a different business's visual identity.

New orders remain paused; historical catalog/provider records are not available-stock proof. Existing orders retain the terms shown when purchased. Imagery labels distinguish AI campaign concepts, previous-run provider renders and genuine archive. Never infer dates, prices, stock, fulfillment or provider health from old notes.

## Preserved operations

Square payment/history records, APLIIQ fulfillment contracts, historical Printful routes, Netlify Database and Resend remain protected. The new preview does not use, migrate or delete them. Reopening commerce requires independent authorization, verified provider readiness and all existing production guards. Never create an order or payment as a test, blind-retry a provider submission or expose credentials.

## Approved release and authoritative live status

The owner explicitly said “yup push it all live, document it and leave it the folder” on October 9. PR #93 merged at `a34c1f0490f80a53ce941a33784c06afbfd6c0f3` using the already-configured named-owner PR exception after all nine checks passed. Repository rules were unchanged and no independent review was claimed. The first Git build failed because the nested package config retained its preview-only command; that build did not publish. The corrective release aligns root and nested contexts, including production approval, origin and the Next-runtime skip flag.

The old IDs above are historical receipts. Current live truth is the exact Netlify site's **published** deploy plus `https://afterhoursagenda.com/release.json`; match its source to GitHub main and verify the artifact. The local deployment report and evidence are retained in `/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/`. Never infer publication from a merge, branch name or this document.

`NETLIFY_NEXT_PLUGIN_SKIP=true` must be in the config Netlify actually selects. It keeps the older UI-installed Next runtime inert without changing host settings. The static runtime excludes newsletter/order/provider APIs; provider/customer resources remain unchanged. Original validation commands remain documented in `AGENTS.md`. New work is preview-first after this approved release.
