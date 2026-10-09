# After Hours Agenda agent contract

**Release completed October 9, 2026:** source `7a23f9846a337de2ac85bb34014d5b3f983ca71c`, production deploy `6ac8bf631f5bb00008938cac`. All 16 live routes and nine browser suites pass. The one-release authorization is spent; new work is preview-first.


This custom-domain project keeps the After Hours Agenda brand. Never substitute an agency or future client's identity. The user corrected the initial rebrand direction on October 9, 2026. Only abstract projects use LFNYC branding.

## Source and scope

- Canonical original checkout: `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website`.
- Audit worktree: `/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/worktree`.
- Branch: `audit/2026-10-09`; new app: `site-preview/`.
- GitHub: `omgitsthedm/aha-website`; production branch: `main`.
- Exact Netlify site: `275b4115-16bf-42fb-9b36-6bce9bb93608`; primary host: `https://afterhoursagenda.com`.
- Read `SOURCE_OF_TRUTH.md`. Confirm physical Git root and `git status --short` before edits. Preserve unrelated work and the original checkout.

The owner explicitly instructed “yup push it all live, document it and leave it the folder” on October 9, 2026. This authorizes the reviewed static migration and necessary release fixes through GitHub main and the exact Netlify site. Ruleset 20717491 normally requires one independent review; it already grants user 55168770 (omgitsthedm) a pull-request-only exception. For this release only, use that existing permission after all nine named checks pass; never change protections or fabricate a review. Auto-merge is disabled. Root netlify.toml selects base site-preview, then Netlify reads site-preview/netlify.toml: keep both configurations aligned. A merged commit or successful local build is not proof of a live release. No DNS/domain change, provider/data mutation, payment, message or form submission is authorized. No global installs or shared configuration edits. Ports 48378/48379 only; use installed Google Chrome. Return to preview-first scope for new work after this release.

## Design and content

Use AHA's current `app/globals.css`, Poppins weights from `app/layout.tsx`, `lib/content/brand-copy.ts`, the canonical `components/ui/SheepMark.tsx` artwork and `data/brand-imagery.json`. The later source contract takes precedence over conflicting July design prose: paper/ink/rose, Poppins 400/700/900, hairline frames, warm plain language and no invented city-origin claims. New preview tokens live in `site-preview/src/styles/tokens.css`.

New orders are paused. Never fabricate product availability, future release dates, reviews, revenue, conversion or search results. Caption AI campaign concepts and previous-run renders accurately. Preserve existing-order terms. The contact enhancement only prepares a local email; no backend delivery or automatic signup is implied.

## Validation

From `site-preview/` on Node 24.21.0: `npm run check`, `npm run test:e2e`, `npm audit`. Build and visually inspect before any draft deploy. Artifact tests reject wrong-business content, transactions and secrets. Run both preview and production modes before release. Hosted checks must verify exact source/hash, routes, headers, ownership files and indexing. `NEEDS-APPROVAL.md` records the approved scope and remaining verification sequence.

## Protected original application

Treat `app/api/`, `lib/square/`, `lib/apliiq/`, `lib/printful/`, `lib/commerce/`, checkout, webhooks, provider mappings and database operations as high risk. Never manufacture an order/payment/customer/refund/fulfillment or send email during verification. Handle required credentials only within explicit authorization; do not print, commit or publish secrets. Preserve all existing provider accounts and data.

Original validation commands remain `npm run lint`, `npm run typecheck`, `npm test`, `npm run validate:all`, `npm run build`, `npm run verify:netlify-site`, `LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live` and `npm run verify:commerce-readiness:netlify`. These do not authorize transactional probes or live mutations. Detailed original design/commerce/database references remain under `docs/` and `db/`; dated handoffs are historical evidence, not current release truth.
