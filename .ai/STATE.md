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
- Updated By: Codex
- Basis: Initial AHA AI-Ops onboarding; local read-only repo, stack, commerce clue, and dirty-state verification
- Git HEAD at onboarding: 23018a0

## Rules Version

- 2026-06-27-aiops-foundation-v1

## State Confidence

- High for canonical path, repo, branch, remote, and dirty status verified in this run.
- Medium for stack and commerce clues from local file inspection.
- Low/TBD for live URL, deploy state, production health, and commerce runtime state.

## Current Live Truth

- Live URL: TBD
- Host: Netlify
- Netlify live deploy status: TBD
- Production health: TBD
- Commerce runtime state: TBD
- Production QA status for this setup task: Not run; no live behavior was changed.

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

- Verify live URL before production claims.
- Verify Netlify deploy metadata before deployment claims.
- Confirm whether dirty untracked files should be kept, ignored, or committed.
- Confirm whether AHA needs `RELEASES.md` for product/drop history.
- Confirm safe observational storefront check path.
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

## Next Agent Directive

AHA AI-Ops onboarding is ready for local commit of governance files only. Continue to treat AHA as Tier 3 high-risk live commerce. Do not edit source behavior, deploy, push, run checkout/payment/order/fulfillment tests, inspect env contents, modify product/inventory/customer/order/fulfillment data, or touch Square/Printful/Netlify live settings without explicit approved scope.

## Emergency / Bypass Notes

- No bypass approved for commerce, source, deploy, push, checkout, inventory, order, customer, fulfillment, Square, Printful, Netlify, or production mutations.
- Bypass/YOLO mode is only an execution accelerator for approved local setup and read-only verification.
- Emergency mode requires stopping forward work, preserving evidence, and using the smallest reversible action.
