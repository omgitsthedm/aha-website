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

- Updated: 2026-07-08 21:57 MST
- Updated By: Codex
- Basis: Aside AI cutover handoff plus Codex verification from local Git, GitHub PR metadata, Netlify CLI/API, DNS resolver checks, and public HTTPS checks.
- Current HEAD: `13c25e83f696b19c7d9230ec4766900cc5485451`
- Git HEAD at onboarding: `23018a0`

## Rules Version

- 2026-06-27-aiops-foundation-v1
- Note: David's current preference is scoped plain-language confirmation for high-risk live changes, not a rigid magic phrase. The generated `.ai/RULES.md` may still contain the older literal `APPROVE LIVE CHANGE` wording until the AI-Ops generator is available and rerun. If there is conflict before a live action, pause and clarify rather than taking the action.

## State Confidence

- High for canonical path, repo, branch, remote, and clean status verified 2026-07-08 21:57 MST.
- High for PR #2 merge metadata verified through GitHub CLI.
- High for Netlify site id, project metadata, build settings, GitHub linkage, custom domain, and latest deploy metadata verified through Netlify CLI/API.
- High for production env var name readiness verified by `npm run verify:commerce-readiness:netlify`; values were not printed.
- High for `afterhoursagenda.com`, `www.afterhoursagenda.com`, and `afterhoursagenda.netlify.app` serving through Netlify by public HTTP checks.
- High for public DNS resolver checks against `1.1.1.1`, `8.8.8.8`, and `9.9.9.9`.
- Medium for Square/Printful webhook dashboard details supplied by Aside handoff; Codex did not inspect secret values or mutate dashboard state.
- Low/TBD for live checkout/payment/order/fulfillment runtime behavior because no live checkout or fulfillment test has been run.

## Current Live Truth

- Primary live URL: `https://afterhoursagenda.com/`
- `www` behavior: `https://www.afterhoursagenda.com/` returns Netlify 301 to `https://afterhoursagenda.com/`.
- Default Netlify URL: `https://afterhoursagenda.netlify.app/`
- Live title verified by guard/browser handoff: `After Hours Agenda | Blacklight Grunge Streetwear`
- Host: Netlify for apex, `www`, and `.netlify.app`.
- Current deployed commit: `13c25e83f696b19c7d9230ec4766900cc5485451`
- Latest verified production deploy: `6a4f2851e4c1b9fb71f86a67`, ready, production, branch `main`, commit-backed.
- Netlify site: `afterhoursagenda`
- Netlify site id: `275b4115-16bf-42fb-9b36-6bce9bb93608`
- Netlify admin: `https://app.netlify.com/projects/afterhoursagenda`
- Netlify custom domain: `afterhoursagenda.com`
- Netlify build settings: GitHub provider, repo `omgitsthedm/aha-website`, branch `main`, command `npm run build`, publish `.next`.
- Netlify `prevent_non_git_prod_deploys`: still reports `false`.
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
- Status before documentation update: clean and aligned with `origin/main`.
- PR #2 (`feature/uiux-doctrine-commerce-hardening`) was merged into `main` as `13c25e83f696b19c7d9230ec4766900cc5485451`.
- Remote feature branch `feature/uiux-doctrine-commerce-hardening` was deleted after merge.
- PR #1 (`feature/retro-grunge-block-overhaul`) was merged earlier as merge commit `55d63fc`.
- Current task is documentation/state update for Claude Code takeover.

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

- Confirm and align Square webhook URL versus `SQUARE_WEBHOOK_NOTIFICATION_URL`. Handoff says Square webhook URL is `https://afterhoursagenda.netlify.app/api/webhooks/square`; Netlify production currently reports non-secret `SQUARE_WEBHOOK_NOTIFICATION_URL=https://www.afterhoursagenda.com/api/webhooks/square`. Square signature verification requires an exact URL match.
- Confirm whether Netlify can enable non-Git production deploy blocking for this site/account; API still reports `prevent_non_git_prod_deploys: false`.
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

- Proposal: Regenerate AI-Ops rules so AHA accepts scoped plain-language confirmation for high-risk live changes instead of requiring a rigid literal magic phrase.
- Reason: David explicitly stated after the cutover that he does not want exact approval phrase requirements going forward.
- Risk: Too-loose approval language can cause accidental live changes; the replacement rule must still require clear scope, explicit user confirmation, and restating the exact action.
- Source evidence: Aside handoff pasted by David in the 2026-07-08 takeover thread.
- Suggested owner: David/Codex or AI-Ops maintainer when the rules generator path is available.

- Proposal: Preserve exact-site Netlify target guard even though Netlify is now Git-linked.
- Reason: AHA already had a wrong-site production incident; `prevent_non_git_prod_deploys` still reports false.
- Risk: Low; guard is non-mutating.
- Source evidence: Netlify API and `npm run verify:netlify-site`.
- Suggested owner: all agents.

Use this section for proposed rule changes before promoting them into `.ai/RULES_HEADER.md` or `~/AI-OPS/TEMPLATES/RULES_BASE.md`.

## Next Steps Queue

- Review `docs/claude-code-live-takeover.md` before further Claude Code work.
- Confirm Square webhook URL/signature alignment.
- Decide whether to update Square webhook URL to `https://www.afterhoursagenda.com/api/webhooks/square` or update Netlify `SQUARE_WEBHOOK_NOTIFICATION_URL` to the exact Square webhook URL.
- Run browser QA on `https://afterhoursagenda.com` desktop and mobile.
- Draft sandbox checkout safe path.
- Plan durable order/event storage and idempotency before fulfillment automation.
- Decide whether AHA needs `.ai/RELEASES.md` for drop/product history.

## Recent Session History

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

## Next Agent Directive

Continue from `main` at `13c25e83f696b19c7d9230ec4766900cc5485451`. AHA is live on `https://afterhoursagenda.com`. Before any deploy or live config work, run `npm run verify:netlify-site`. Before relying on commerce backend state, run `npm run verify:commerce-readiness:netlify`. After deploy, run `npm run verify:netlify-live` and `LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live`. Do not run live checkout/payment/order/fulfillment tests, inspect env contents, modify product/inventory/customer/order/fulfillment data, change DNS, or enable fulfillment automation without clear scoped confirmation and a safe path.

## Emergency / Bypass Notes

- 2026-07-08: David approved scoped live Netlify restore for AHA after wrong-site incident. This did not approve checkout/payment/order/fulfillment tests, env inspection, Square/Printful changes, product/inventory/customer/order/fulfillment data mutation, or unrelated infrastructure changes.
- 2026-07-08: Custom domain cutover completed by Aside AI. That cutover does not authorize future live checkout, Square order, Printful fulfillment, DNS, or deploy mutations without a new scoped confirmation.
- Bypass/YOLO mode is only an execution accelerator for approved local setup and read-only verification.
- Emergency mode requires stopping forward work, preserving evidence, and using the smallest reversible action.
