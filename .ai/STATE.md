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

- Updated: 2026-07-08
- Updated By: Codex
- Basis: Netlify wrong-site incident triage, PR merge to `main`, exact-site production restore, and live AHA content verification; no checkout/payment/order/fulfillment QA
- Git HEAD at onboarding: 23018a0

## Rules Version

- 2026-06-27-aiops-foundation-v1

## State Confidence

- High for canonical path, repo, branch, remote, and dirty status verified in this run.
- Medium for stack and commerce clues from local file inspection.
- High for live URL + storefront homepage reachability (verified read-only 2026-06-27).
- High for Netlify site id, project metadata, and wrong-site incident cause verified through Netlify CLI/API on 2026-07-08.
- Low/TBD for commerce runtime state (not inspected/exercised).

## Current Live Truth

- Live URL (Netlify project): `https://afterhoursagenda.netlify.app` — restored 2026-07-08 to AHA content from `main` merge commit `55d63fc`, production deploy `6a4e3854c37b683eab4d38b8`, title `After Hours Agenda | Graphic Tees and Rebel Streetwear`, H1 `Wear It Loud`.
- Wrong-site incident: before restoration, `https://afterhoursagenda.netlify.app/` served unrelated Pole Position IT HTML. The previous published deploy had `commit_ref: null`, `branch: null`, `commit_url: null`, and empty site `build_settings`.
- Custom domain: `https://www.afterhoursagenda.com/` — **HTTP 200** but `server: cloudflare` / Weebly origin observed 2026-07-08; it is not currently served by this Netlify project.
- Host: Netlify for `.netlify.app`; custom domain currently Cloudflare/Weebly.
- Netlify live deploy status after restore: Serving AHA content from deploy `6a4e3854c37b683eab4d38b8`, published `2026-07-08T11:46:13.747Z`, deploy title `AHA production restore from omgitsthedm/aha-website@55d63fc`.
- Production health: Netlify URL is reachable and no longer contains Pole Position strings. Custom domain still shows the public AHA storefront outside Netlify. No deeper route/commerce checks run.
- Commerce runtime state: TBD — no transactional/commerce paths exercised.
- Production QA status: Read-only public GET/HEAD only; NO transactional or commerce QA, no mutation.

## Dirty Repo State

- Branch: `feature/retro-grunge-block-overhaul`, based on `backup/consolidation-20260629`
- Current working set: retro grunge / vibrant block storefront redesign plus lint dependency cleanup, pending local commit/push at this stamp.
- Prior onboarding dirty files were preserved into the backup branch baseline before this work; no `.env` contents were inspected.

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
- Production dependency audit still reports Next.js/PostCSS advisories; npm's available automated fix is a breaking upgrade to `next@16.2.10`, so handle as a separate framework migration with Netlify compatibility review.
- ~~Netlify production publish/live verification was not run for the retro grunge redesign. Feature branch push is not a production approval.~~ DONE 2026-07-08: PR #1 merged to `main`, exact-site production deploy `6a4e3854c37b683eab4d38b8` published, and `npm run verify:netlify-live` passed.
- Netlify site must be Git-linked and locked against non-Git production deploys so manual cross-project production deploys cannot recur. CLI/API attempts on 2026-07-08 did not successfully set `prevent_non_git_prod_deploys`; it still reports false.

## Do Not Touch

- `.env`
- `.env.local`
- `PRODUCT_CATALOG.json`
- `REORGANIZATION_LOG.csv`
- checkout/payment code
- Square integration behavior
- Printful integration behavior
- product/inventory/customer/order/fulfillment data
- Netlify deploy settings, except for the 2026-07-08 approved exact-site restore and non-secret guardrail documentation/scripts
- live commerce analytics/pixels unless explicitly approved

## Proposed Changes / Inbox

- Proposal: Repair Netlify Git integration so project `afterhoursagenda` deploys only from `https://github.com/omgitsthedm/aha-website.git` and `main`, then enable Netlify's non-Git production deploy block.
- Reason: The 2026-07-08 wrong-site incident bypassed GitHub entirely because the Netlify project was unlinked/manual.
- Risk: Git-link repair may require Netlify UI/GitHub app access and must preserve environment variables. Do not delete/recreate the site.
- Source evidence: Netlify API showed empty `build_settings`, `commit_ref: null`, `branch: null`, `commit_url: null`, and `prevent_non_git_prod_deploys: false` on the published wrong deploy.
- Suggested owner: David/Codex with Netlify UI access.

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
- 2026-07-08: Codex implemented the black-background retro grunge / vibrant block visual overhaul on `feature/retro-grunge-block-overhaul`, covering global tokens, nav/footer, homepage, shop, product detail, cart, modal/drawer, collection/static pages, and order confirmation. Added standard Next 14 lint setup, removed unused `@imgly/background-removal-node`, added a `glob` override for lint tooling, and verified `npm run lint` plus `npm run build`. No checkout/payment/Square/Printful behavior changes, no `.env` inspection, no Netlify publish, and no live transactional QA.
- 2026-07-08: Codex verified `afterhoursagenda.netlify.app` was serving unrelated Pole Position IT content from Netlify project `afterhoursagenda` / site id `275b4115-16bf-42fb-9b36-6bce9bb93608`. Netlify metadata showed the published deploy was not Git-backed (`commit_ref`, `branch`, and `commit_url` all null) and the site had empty build settings with non-Git production deploys allowed. David approved a scoped live restore; guardrails are being added before production publish.
- 2026-07-08: Codex merged PR #1 to `main` as merge commit `55d63fc`, preview-deployed exact site id `275b4115-16bf-42fb-9b36-6bce9bb93608` as deploy `6a4e37f520d26e3bd1d0b0aa`, verified AHA title/H1/no Pole Position strings, then production-deployed exact site id as deploy `6a4e3854c37b683eab4d38b8`. Live guard passed for `https://afterhoursagenda.netlify.app/`. Attempted to set `prevent_non_git_prod_deploys`; Netlify either rejected or ignored the CLI/API payload and the setting remains false.

## Next Agent Directive

Continue to treat AHA as Tier 3 high-risk live commerce. The `.netlify.app` URL is restored, but Netlify Git linking and non-Git production deploy blocking remain unresolved. Before any AHA Netlify deploy, run `npm run verify:netlify-site` and target site id `275b4115-16bf-42fb-9b36-6bce9bb93608` explicitly. After deploy, run `npm run verify:netlify-live`. Do not run checkout/payment/order/fulfillment tests, inspect env contents, modify product/inventory/customer/order/fulfillment data, or touch Square/Printful behavior without a separate scoped approval.

## Emergency / Bypass Notes

- 2026-07-08: David approved scoped live Netlify restore for AHA after wrong-site incident. This does not approve checkout/payment/order/fulfillment tests, env inspection, Square/Printful changes, product/inventory/customer/order/fulfillment data mutation, or unrelated infrastructure changes.
- Bypass/YOLO mode is only an execution accelerator for approved local setup and read-only verification.
- Emergency mode requires stopping forward work, preserving evidence, and using the smallest reversible action.
