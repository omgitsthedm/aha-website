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

- Updated: 2026-06-27
- Updated By: Claude
- Basis: Read-only live/deploy verification pass (public HEAD/GET only); live URL confirmed from repo-evidenced source + observed
- Git HEAD at onboarding: 23018a0

## Rules Version

- 2026-06-27-aiops-foundation-v1

## State Confidence

- High for canonical path, repo, branch, remote, and dirty status verified in this run.
- Medium for stack and commerce clues from local file inspection.
- High for live URL + storefront homepage reachability (verified read-only 2026-06-27).
- Low/TBD for Netlify deploy revision/metadata and commerce runtime state (not inspected/exercised).

## Current Live Truth

- Live URL (repo-evidenced canonical): `https://afterhoursagenda.netlify.app` — **HTTP 200**, `server: Netlify`, Netlify Edge, ~0.9s (read-only GET 2026-06-27). Found in committed `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx`, `app/api/checkout/route.ts`.
- Custom domain: `https://www.afterhoursagenda.com/` — **HTTP 200** but `server: cloudflare` (Cloudflare-fronted; origin not confirmed read-only). Apex `afterhoursagenda.com` → 301 → `www`. NOTE: custom domain is observed live but NOT asserted from repo files; relationship between Cloudflare front and the Netlify deploy is unverified.
- Host: Netlify (confirmed on `.netlify.app`); custom domain served via Cloudflare.
- Netlify live deploy status: Serving (homepage 200) as of 2026-06-27 read-only check. Deploy revision/build metadata NOT inspected (no Netlify API/CLI read).
- Production health: storefront homepage returns 200 on both URLs. No deeper route/commerce checks run.
- Commerce runtime state: TBD — no transactional/commerce paths exercised.
- Production QA status: Read-only public GET/HEAD only; NO transactional or commerce QA, no mutation.

## Dirty Repo State

- Branch: main, up to date with `origin/main`
- Dirty status before AI-Ops onboarding: DIRTY:4 untracked additions only
- Tracked source modifications before AI-Ops onboarding: none
- Dirty files recorded, not cleaned or modified:
  - `components/homepage/SubwayMap.tsx`
  - `public/brand/mosaic-hero.png`
  - `CLAUDE.md`
  - `.claude/`

## Commerce Risk

- Stack: Next.js / Netlify
- Commerce: `app/api/checkout` present; Square + Printful referenced in local code/docs.
- Checkout/payment/order/fulfillment paths are transactional and gated.
- `.env.local` exists by filename only; contents were not inspected.

## QA-PENDING

- ~~Verify live URL before production claims.~~ DONE 2026-06-27: `afterhoursagenda.netlify.app` 200 (Netlify); `www.afterhoursagenda.com` 200 (Cloudflare-fronted).
- ~~Confirm safe observational storefront check path.~~ DONE: read-only HEAD/GET to public homepage is the safe path.
- Verify Netlify deploy revision/metadata before any deployment claim (needs Netlify API/CLI read; not yet done).
- Confirm the Cloudflare↔Netlify relationship for `www.afterhoursagenda.com` (is Cloudflare proxying the Netlify origin?).
- Confirm whether dirty untracked files should be kept, ignored, or committed.
- Confirm whether AHA needs `RELEASES.md` for product/drop history.
- Confirm Square/Printful integration boundaries without reading secrets.

## Do Not Touch

- `.env`
- `.env.local`
- `PRODUCT_CATALOG.json`
- `REORGANIZATION_LOG.csv`
- checkout/payment code
- Square integration behavior
- Printful integration behavior
- product/inventory/customer/order/fulfillment data
- Netlify deploy settings
- live commerce analytics/pixels unless explicitly approved

## Proposed Changes / Inbox

- None yet.

Use this section for proposed rule changes before promoting them into `.ai/RULES_HEADER.md` or `~/AI-OPS/TEMPLATES/RULES_BASE.md`.

## Next Steps Queue

- Run a fresh AHA `SESSION START` before the next AHA task if another agent takes over.
- Decide whether AHA needs `.ai/RELEASES.md` for drop/product history.
- Confirm how to handle the four pre-existing untracked dirty files.
- Identify a safe read-only live URL verification path if David requests production observation.

## Recent Session History

- 2026-06-27: Codex performed initial AHA AI-Ops onboarding from read-only local inventory and local repo inspection. Created `.ai` governance files and did not edit source behavior, deploy, push, run commerce QA, inspect env contents, or modify the pre-existing dirty files.
- 2026-06-27: AHA SESSION START dry run completed. Generated rules verified against `RULES_HEADER.md` + `RULES_BASE.md` with checksum `4054569368:9046`. Confirmed canonical repo, branch, remote, dirty state, lock, and commerce gates. No source behavior, push, deploy, production QA, checkout/payment/order/fulfillment test, env inspection, dirty-file cleanup, or commerce mutation. AHA AI-Ops onboarding files are ready for local commit.
- 2026-06-27: Claude ran read-only live/deploy verification (public HEAD/GET only). Verified `afterhoursagenda.netlify.app` → 200 (Netlify Edge) and `www.afterhoursagenda.com` → 200 (Cloudflare-fronted); apex 301→www. Updated Current Live Truth + State Confidence; cleared the live-URL/safe-path QA-PENDING items. NO transactional/commerce QA, no push, no deploy, no env inspection, no dirty-file changes.

## Next Agent Directive

AHA AI-Ops onboarding is ready for local commit of governance files only. Continue to treat AHA as Tier 3 high-risk live commerce. Do not edit source behavior, deploy, push, run checkout/payment/order/fulfillment tests, inspect env contents, modify product/inventory/customer/order/fulfillment data, or touch Square/Printful/Netlify live settings without explicit approved scope.

## Emergency / Bypass Notes

- No bypass approved for commerce, source, deploy, push, checkout, inventory, order, customer, fulfillment, Square, Printful, Netlify, or production mutations.
- Bypass/YOLO mode is only an execution accelerator for approved local setup and read-only verification.
- Emergency mode requires stopping forward work, preserving evidence, and using the smallest reversible action.
