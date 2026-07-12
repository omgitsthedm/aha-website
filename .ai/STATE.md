# After Hours Agenda AI-Ops State

## Identity

- Project Code: LFNYC-AHA
- Name: After Hours Agenda
- Business Line: After Hours Agenda under Little Fight NYC
- Tier: Tier 3 - Live Commerce / Internal Brand
- Risk: High
- Canonical Path: /Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website/aha-website
- Git-backed: yes
- Remote: https://github.com/omgitsthedm/aha-website.git

## Current Stamp

- Updated: 2026-07-11 21:14 MST
- Updated By: Codex
- Basis: Aside AI cutover handoff plus Codex verification from local Git, GitHub PR metadata, Netlify CLI/API, DNS resolver checks, and public HTTPS checks.
- Current production HEAD: `5a974d00541336d7c05e003712ea06dfa2b36bc7`
- Git HEAD at onboarding: `23018a0`

## Rules Version

- 2026-06-27-aiops-foundation-v1
- Note: clear, scoped plain-language confirmation is sufficient for high-risk live changes. No fixed wording or capitalization is required.

## State Confidence

- High for canonical path, repo, branch, remote, and clean status verified 2026-07-08 21:57 MST.
- High for PR #2 merge metadata verified through GitHub CLI.
- High for Netlify site id, project metadata, build settings, GitHub linkage, custom domain, and latest deploy metadata verified through Netlify CLI/API.
- High for production env var name readiness verified by `npm run verify:commerce-readiness:netlify`; values were not printed.
- High for production-only Square credential scoping and Netlify non-Git production deploy protection verified 2026-07-11 through authenticated Netlify metadata without printing credential values.
- High for `afterhoursagenda.com`, `www.afterhoursagenda.com`, and `afterhoursagenda.netlify.app` serving through Netlify by public HTTP checks.
- High for public DNS resolver checks against `1.1.1.1`, `8.8.8.8`, and `9.9.9.9`.
- Medium for Square/Printful webhook dashboard details supplied by Aside handoff; Codex did not inspect secret values or mutate dashboard state.
- Low/TBD for live checkout/payment/order/fulfillment runtime behavior because no live checkout or fulfillment test has been run.

## Current Live Truth

- Primary live URL: `https://afterhoursagenda.com/`
- `www` behavior: `https://www.afterhoursagenda.com/` returns Netlify 301 to `https://afterhoursagenda.com/`.
- Default Netlify URL: `https://afterhoursagenda.netlify.app/`
- Live title verified by guard: `After Hours Agenda | Independent NYC Streetwear`
- Host: Netlify for apex, `www`, and `.netlify.app`.
- Current deployed commit: `5a974d00541336d7c05e003712ea06dfa2b36bc7`
- Latest verified commit-backed production deploy: `6a5313742afcc70008fba2c1`, ready, production, branch `main`.
- Netlify site: `afterhoursagenda`
- Netlify site id: `275b4115-16bf-42fb-9b36-6bce9bb93608`
- Netlify admin: `https://app.netlify.com/projects/afterhoursagenda`
- Netlify custom domain: `afterhoursagenda.com`
- Netlify build settings: GitHub provider, repo `omgitsthedm/aha-website`, branch `main`, command `npm run build`, publish `.next`.
- Netlify `prevent_non_git_prod_deploys`: enabled and verified `true` on 2026-07-11.
- Production QA status: public read-only checks passed; NO live checkout/payment/order/fulfillment mutation has been performed.

## Domain / DNS Truth

- Authoritative DNS provider reported by handoff: Wix DNS
- Nameservers:
  - `ns8.wixdns.net`
  - `ns9.wixdns.net`
- Apex A record: `afterhoursagenda.com -> 75.2.60.5`
- `www` CNAME: `www.afterhoursagenda.com -> afterhoursagenda.netlify.app`
- Google Workspace MX records were preserved per handoff.
- Public resolver checks against `1.1.1.1`, `8.8.8.8`, and `9.9.9.9` confirmed Netlify records.
- Old Square/Weebly website is no longer the DNS target for apex or `www`.

## Repo State

- Branch: `main`
- Status: clean, pushed, and aligned with `origin/main`; PR #3 merged as `5a974d0` after every required check passed.
- Production: `https://afterhoursagenda.com` passed all eight desktop/mobile Playwright checks, exact-site guard, commerce-readiness name checks, and both Netlify live guards.
- GitHub billing is restored. Dependency Graph was enabled, and the repaired CI, E2E, Lighthouse, security, dependency-review, and review checks are green.
- PR #2 (`feature/uiux-doctrine-commerce-hardening`) was merged into `main` as `13c25e83f696b19c7d9230ec4766900cc5485451`.
- Remote feature branch `feature/uiux-doctrine-commerce-hardening` was deleted after merge.
- PR #1 (`feature/retro-grunge-block-overhaul`) was merged earlier as merge commit `55d63fc`.
- Current task is the flagship storefront technical audit and hardening pass documented in `docs/AUDIT-FLAGSHIP-HARDENING-2026-07-11.md`.

## Commerce Risk

- Stack: Next.js / Netlify
- Commerce: Square + Printful
- Checkout route: `app/api/checkout`
- Webhooks:
  - Square: `app/api/webhooks/square/route.ts`
  - Printful: `app/api/webhooks/printful/route.ts`
- Readiness endpoint: `app/api/commerce/readiness/route.ts`
- Current production fulfillment mode: `manual`
- Webhook routes verify signatures and acknowledge/log events only.
- Printful fulfillment automation is not implemented.
- `.env.local` exists by filename only; contents were not inspected.

## QA-PENDING

- Deploy and verify the committed Square webhook URL alignment, then send a Square test notification. Rotate the signature key only if the signed test proves the current key is mismatched.
- Add real Square Sandbox credentials scoped only to deploy previews/staging; production credentials are now production-only and secret where appropriate.
- Create and approve a sandbox checkout test plan.
- Create and approve a live checkout safe path before any live payment/order test.
- Add durable order/event storage before fulfillment automation.
- Add idempotency keyed by Square webhook event/order/payment identifiers.
- Map Square catalog/variation IDs to Printful variants.
- Add Printful draft-order dry-run/manual-review flow.
- Add shipment tracking/order status flow.
- Confirm whether AHA needs `.ai/RELEASES.md` for product/drop history.
- Production dependency audit still reports Next.js/PostCSS advisories; npm's available automated fix is a breaking upgrade to `next@16.2.10`, so handle as a separate framework migration with Netlify compatibility review.

## Do Not Touch Without Scoped Confirmation

- `.env`
- `.env.local`
- `PRODUCT_CATALOG.json`
- `REORGANIZATION_LOG.csv`
- live checkout/payment/order/customer/fulfillment data
- Square production settings or records
- Printful production settings or records
- product/inventory/customer/order/fulfillment data
- DNS records
- Netlify production deploy settings
- live commerce analytics/pixels

Name-only env readiness checks and public read-only GET/HEAD verification are allowed.

## Proposed Changes / Inbox

- Completed 2026-07-11: AI-Ops rules now accept scoped plain-language confirmation and evaluate intent instead of matching a fixed token.
- Risk: Too-loose approval language can cause accidental live changes; the replacement rule must still require clear scope, explicit user confirmation, and restating the exact action.
- Source evidence: Aside handoff pasted by David in the 2026-07-08 takeover thread.
- Suggested owner: David/Codex or AI-Ops maintainer when the rules generator path is available.

- Proposal: Preserve exact-site Netlify target guard even though Netlify is now Git-linked.
- Reason: AHA already had a wrong-site production incident; `prevent_non_git_prod_deploys` is now true, and the exact-site guard remains useful defense in depth.
- Risk: Low; guard is non-mutating.
- Source evidence: Netlify API and `npm run verify:netlify-site`.
- Suggested owner: all agents.

Use this section for proposed rule changes before promoting them into `.ai/RULES_HEADER.md` or `~/AI-OPS/TEMPLATES/RULES_BASE.md`.

## Next Steps Queue

- Review `docs/claude-code-live-takeover.md` before further Claude Code work.
- Send a Square test notification to the aligned non-redirecting endpoint from the authenticated Developer Console. The API attempt could not authenticate because Netlify correctly redacts the secret token after it was marked secret; no notification was delivered and no key was rotated.
- Run browser QA on `https://afterhoursagenda.com` desktop and mobile.
- Draft sandbox checkout safe path.
- Plan durable order/event storage and idempotency before fulfillment automation.
- Decide whether AHA needs `.ai/RELEASES.md` for drop/product history.

## Recent Session History

- 2026-07-11: GitHub billing was restored. Codex enabled Dependency Graph, repaired CI browser/Lighthouse setup, and verified all PR checks green. PR #3 merged as `5a974d0`; GitHub post-merge CI/E2E/security passed, Netlify production deploy `6a5313742afcc70008fba2c1` is ready, exact-site/commerce/live guards passed, and all 8 live desktop/mobile Playwright checks passed. A Square API test notification attempt returned 401 because the now-secret Netlify token is intentionally non-readable; no event was delivered and no signature key was changed.

- 2026-07-11: Codex pushed the full storefront/external-remediation branch and opened draft PR #3. Netlify production credentials are production-only, the Square access token is secret, non-Git production deploys are blocked, and preview/branch contexts use a credential-free internal catalog while checkout stays fail-closed. Netlify preview `821966e` passed all 8 desktop/mobile Playwright tests. GitHub Actions did not start because the account is locked for a billing issue, so production merge, deploy verification, and signed Square test notification remain blocked.

- 2026-07-11: Codex audited the public production site and local flagship candidate, then fixed crawler-visible metadata placement, product offer structured data, mobile-navigation ARIA integrity, collection-filter accessible names, size-table semantics, image fallback sizing, request-local Square catalog deduplication, security headers, and page metadata. Post-fix local crawl: Structured Data 100, Accessibility 81, Core SEO 91; remaining error counts are local HTTP/production-sitemap artifacts. Typecheck, lint, 21 unit tests, catalog/provider/margin validators, production build, and 4 explicit-URL Playwright desktop/mobile tests passed. No live checkout, payment, order, webhook, fulfillment, provider configuration, secret value, product mapping, deploy, or production mutation occurred. See `docs/AUDIT-FLAGSHIP-HARDENING-2026-07-11.md`.

- 2026-07-11: With David's scoped authorization, Codex enabled Netlify non-Git production deploy protection and moved Square production credentials from all-context exposure to production-only scope, marking the access token secret. Code now aligns the Square notification URL to the existing non-redirecting subscription, enforces a Square-compatible CSP, adds crawlable shop pagination, and replaces generic customer-visible provider copy. Production deploy and signed webhook test remain pending the Git-backed release; Sandbox credentials remain unavailable rather than being fabricated or copied from production.

- 2026-07-11: Codex built a local flagship storefront evolution on `feature/flagship-storefront-20260711` from clean `main` at `f57ce6b`. Homepage, About, Lookbook, shared design states, metadata/structured data, hero asset delivery, and product-detail UI resilience were improved. Typecheck, lint, 21 unit tests, all product/provider/margin validators, production build, 4 Playwright desktop/mobile smoke tests, a manual local add-to-bag/cart path, and Lighthouse (97/100/100/100) passed. No protected product data, checkout/provider behavior, secrets, live settings, push, merge, deploy, payment, order, or fulfillment was touched. See `docs/FLAGSHIP-STOREFRONT-HANDOFF-2026-07-11.md`.

- 2026-06-27: Codex performed initial AHA AI-Ops onboarding from read-only local inventory and local repo inspection. Created `.ai` governance files and did not edit source behavior, deploy, push, run commerce QA, inspect env contents, or modify the pre-existing dirty files.
- 2026-06-27: AHA SESSION START dry run completed. Generated rules verified against `RULES_HEADER.md` + `RULES_BASE.md` with checksum `4054569368:9046`. Confirmed canonical repo, branch, remote, dirty state, lock, and commerce gates. No source behavior, push, deploy, production QA, checkout/payment/order/fulfillment test, env inspection, dirty-file cleanup, or commerce mutation.
- 2026-06-27: Claude ran read-only live/deploy verification (public HEAD/GET only). Verified `afterhoursagenda.netlify.app` 200 (Netlify) and `www.afterhoursagenda.com` 200 (Cloudflare-fronted); apex 301 to `www`. NO transactional/commerce QA, no push, no deploy, no env inspection, no dirty-file changes.
- 2026-07-08: Codex implemented the black-background retro grunge / vibrant block visual overhaul on `feature/retro-grunge-block-overhaul`; verified lint/build; no checkout/payment/Square/Printful behavior changes, env inspection, Netlify publish, or live transactional QA.
- 2026-07-08: Codex verified `afterhoursagenda.netlify.app` was serving unrelated Pole Position IT content from Netlify project `afterhoursagenda` / site id `275b4115-16bf-42fb-9b36-6bce9bb93608`. Netlify metadata showed the published deploy was not Git-backed and the site had empty build settings with non-Git production deploys allowed.
- 2026-07-08: Codex merged PR #1 to `main` as `55d63fc`, preview-deployed and production-deployed exact site id, restoring AHA content at `afterhoursagenda.netlify.app`.
- 2026-07-08: Codex implemented local `MASTER-UIUX-HANDOFF-v2.md` DTC storefront hardening on `feature/uiux-doctrine-commerce-hardening`; verified lint/build and Playwright route checks; no push, deploy, env inspection, checkout, or Square/Printful behavior mutation.
- 2026-07-08: Codex created `docs/www-cutover-commerce-plan.md`, then added Netlify commerce backend readiness scaffolding and `docs/netlify-commerce-backend-readiness.md`; verified lint/build/site guard/name-only readiness before env setup.
- 2026-07-08: Aside AI pushed the feature branch, opened and merged PR #2 into `main`, linked Netlify to GitHub, configured production env names, moved DNS from Square/Weebly/Wix records to Netlify, configured Square and Printful webhooks/tokens without printing secrets, and deployed production commit `13c25e8`.
- 2026-07-08 21:57 MST: Codex took over from Aside handoff, fetched `main`, verified PR #2 merge, Netlify Git link/build settings/custom domain/latest deploy, production readiness env names, DNS, apex/`www` HTTPS, and `.netlify.app` live guard. No live checkout, Square order, Printful fulfillment, env secret inspection, DNS change, or production mutation performed by Codex during takeover.
- 2026-07-08 (later, Claude): Definitive de-drift pass across the AHA client folder. Pushed pending docs commit `ba0408b` to `origin/main` (repo was ahead 1). Rewrote the stale AHA-root paperwork (`PROJECT_STATUS.md`, `NEXT_STEPS.md`, `docs/plan.md`, `README.md`, `02-…Status.md`) to LIVE truth with old bodies kept as history; added live-truth banners to root `CLAUDE.md`/`AGENTS.md`; created a single `START-HERE.md` entrypoint and `AUDIT-2026-07-08.md`. Quarantined stray/dup folders (`aha-website 2` empty dup, `aha-laser-netlify-demo`, `AHA Concepts 2` byte-identical dup, 2 misplaced YouTube `takeout-*.zip`) into `_archive-2026-07-08/` (moved, nothing deleted). Verified `npm run build` passes and `verify:netlify-site` + `verify:netlify-live` (netlify.app and apex) all pass. NO live checkout/payment/order/fulfillment, env secret inspection, DNS change, Square/Printful dashboard change, or `netlify.toml` webhook-URL edit. Square webhook URL alignment left for David's scoped confirmation (see `AUDIT-2026-07-08.md` §3a; recommendation: match both sides to the non-redirecting `netlify.app` URL, or both to apex — never `www` which 301s).

- 2026-07-08 (Claude, follow-up): Found the de-drift docs commits (`ba0408b`, `dbb29fe`) had been **failing** Netlify production builds (exit 2) while live stayed stuck on `13c25e8`. Root cause via deploy validation report: Netlify **secrets scanning** flagged non-secret PUBLIC identifiers that the new docs added — `NEXT_PUBLIC_SQUARE_APP_ID`/`SQUARE_APPLICATION_ID` (Square app id, shipped to browser), `PRINTFUL_STORE_ID`, and `SQUARE_LOCATION_ID` — in `SOURCE_OF_TRUTH.md` + `docs/`. Fix: added `SECRETS_SCAN_OMIT_KEYS` (those 4 public keys only) to `netlify.toml [build.environment]`; real credentials (`SQUARE_ACCESS_TOKEN`, `PRINTFUL_API_TOKEN`, webhook signature keys) remain scanned. Commit `f44b21c` now builds green and is the **published production deploy**; `verify:netlify-live` passes on `.netlify.app` and apex. Local = GitHub = live fully aligned.

- 2026-07-08 (Claude, ecommerce build kickoff): Installed the governing build spec (`docs/MASTER-BUILD-INSTRUCTION.md`) + controlling UI/UX doctrine (`docs/MASTER-UIUX-HANDOFF-v2.md`, sourced from Desktop) and the §47 block in `CLAUDE.md`. David approved a full continuous 6-phase ecommerce build; DB = Netlify DB (Neon, free tier); live posture = build on live infra but keep real-charge + live-Printful-confirm switches OFF until each flow passes Sandbox/dry-run. **Phase 1 (foundation) COMPLETE and pushed on `main`:** full `.env.example` + `netlify.toml` contexts/branch model (Printful live flags OFF everywhere); design tokens (`app/globals.css` + `docs/design-tokens.md`); internal product model (`lib/types/product.ts`) + `data/` manifest/maps + loader + shared `purchasable` gate; 4 validation scripts + `margin-check` (tsx, all pass at 0 active products); DB schema `db/migrations/0001_init.sql` + Neon client + `db:migrate` + `db/README.md`; CI gates `.github/workflows/{ci,e2e,lighthouse,security,release}.yml` + vitest (4/4) + Playwright smoke + `docs/ci-branch-protection.md`; `README.md` + `AGENTS.md` refreshed. Typecheck + build + unit + validations all green; every commit deployed clean. **Phase 2-6 pending** — see Next Steps. No live checkout/charge/fulfillment, no env-secret inspection, no DNS/Netlify-prod-settings mutation.
- BLOCKERS for Phase 2-6 realness (need David): (1) provision Netlify DB (one-click, `db/README.md`); (2) real per-product Printful v2 catalog variant IDs + production print-file URLs + placements for the 131 products (the core mapping data — cannot be invented); (3) Square Sandbox app credentials for CI/preview testing; (4) email/SMS provider accounts + analytics keys (Phase 5); (5) final go to flip live Square charges + Printful confirmation after the Sandbox flow passes.

## Next Agent Directive

Continue from clean, pushed `main` at `5a974d00541336d7c05e003712ea06dfa2b36bc7`; review `docs/AUDIT-FLAGSHIP-HARDENING-2026-07-11.md`. AHA production is aligned at `https://afterhoursagenda.com`. The remaining provider check is a Square Developer Console test notification from the enabled production subscription; do not expose or replace the secret token merely to automate that check. Initialize the Square payment field on the approved HTTPS domain without charging. Do not run a live charge/order/fulfillment test, modify product/inventory/customer/order/fulfillment data, change DNS, or enable fulfillment automation without a separately verified safe path.

## Emergency / Bypass Notes

- 2026-07-08: David approved scoped live Netlify restore for AHA after wrong-site incident. This did not approve checkout/payment/order/fulfillment tests, env inspection, Square/Printful changes, product/inventory/customer/order/fulfillment data mutation, or unrelated infrastructure changes.
- 2026-07-08: Custom domain cutover completed by Aside AI. That cutover does not authorize future live checkout, Square order, Printful fulfillment, DNS, or deploy mutations without a new scoped confirmation.
- Bypass/YOLO mode is only an execution accelerator for approved local setup and read-only verification.
- Emergency mode requires stopping forward work, preserving evidence, and using the smallest reversible action.
