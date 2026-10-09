# After Hours Agenda agent contract

This custom-domain project keeps the After Hours Agenda brand. Never substitute an agency or future client's identity. The user corrected the initial rebrand direction on October 9, 2026. Only abstract projects use LFNYC branding.

## Source and scope

- Canonical original checkout: `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website`.
- Audit worktree: `/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/worktree`.
- Branch: `audit/2026-10-09`; new app: `site-preview/`.
- GitHub: `omgitsthedm/aha-website`; production branch: `main`.
- Exact Netlify site: `275b4115-16bf-42fb-9b36-6bce9bb93608`; primary host: `https://afterhoursagenda.com`.
- Read `SOURCE_OF_TRUTH.md`. Confirm physical Git root and `git status --short` before edits. Preserve unrelated work and the original checkout.

The user approved moving the reviewed AHA website toward production on October 9, 2026. Prepare and verify the documented static migration through GitHub main and the exact Netlify site. GitHub ruleset 20717491 requires one independent approval and nine named checks; do not bypass or weaken it. Auto-merge is disabled. Root netlify.toml on this branch is the production candidate, not proof of a live release. No DNS/domain change, provider/data mutation, payment, message or form submission is authorized. No global installs or shared configuration edits. Ports 48378/48379 only; use installed Google Chrome. Return to preview-first scope for new work after this release.

## Design and content

Use AHA's current `app/globals.css`, Poppins weights from `app/layout.tsx`, `lib/content/brand-copy.ts`, the canonical `components/ui/SheepMark.tsx` artwork and `data/brand-imagery.json`. The later source contract takes precedence over conflicting July design prose: paper/ink/rose, Poppins 400/700/900, hairline frames, warm plain language and no invented city-origin claims. New preview tokens live in `site-preview/src/styles/tokens.css`.

New orders are paused. Never fabricate product availability, future release dates, reviews, revenue, conversion or search results. Caption AI campaign concepts and previous-run renders accurately. Preserve existing-order terms. The contact enhancement only prepares a local email; no backend delivery or automatic signup is implied.

## Validation

From `site-preview/` on Node 24.21.0: `npm run check`, `npm run test:e2e`, `npm audit`. Build and visually inspect before any draft deploy. Artifact tests reject wrong-business content, transactions and secrets. Run both preview and production modes before release. Hosted checks must verify exact source/hash, routes, headers, ownership files and indexing. `NEEDS-APPROVAL.md` records the independent-review gate and the remaining cutover sequence.

## Protected original application

Treat `app/api/`, `lib/square/`, `lib/apliiq/`, `lib/printful/`, `lib/commerce/`, checkout, webhooks, provider mappings and database operations as high risk. Never manufacture an order/payment/customer/refund/fulfillment or send email during verification. Handle required credentials only within explicit authorization; do not print, commit or publish secrets. Preserve all existing provider accounts and data.

Original validation commands remain `npm run lint`, `npm run typecheck`, `npm test`, `npm run validate:all`, `npm run build`, `npm run verify:netlify-site`, `LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live` and `npm run verify:commerce-readiness:netlify`. These do not authorize transactional probes or live mutations. Detailed original design/commerce/database references remain under `docs/` and `db/`; dated handoffs are historical evidence, not current release truth.
