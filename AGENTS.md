# After Hours Agenda agent contract

## Current custom-checkout authorization — October 15, 2026

The owner explicitly instructed: “fix it all, don't stop until someone can load up their cart, and check out.” Restore an AHA-owned multi-product cart and embedded Square checkout in the active `site-preview/` application, including supported configured wallets and Afterpay subject to eligibility. This supersedes the individual-product-link-only behavior below. Preserve prices, the 13 approved Yikes variants, the existing merchant-approved AZ-only 8.1% order tax, free domestic / existing $25 supported international shipping, current private label, consent controls, and the active durable Square-to-Apliiq webhook. The owner authorized publication of the completed checkout. The active transactional confirmation/shipment outbox may process new verified customer orders; development verification must not send messages. No paid production test, sample, ad spend or customer message is authorized. Use Square Sandbox for non-billable payment verification where available. Do not reactivate old Next.js/provider pipelines. Keep checkout session migrations additive and identical at repository root and active package. Document actual browser/device coverage without claiming every browser version or a genuine paid-order round trip.

## Current authorized launch — October 14, 2026

The owner explicitly authorized going live with the first two Yikes! products and retiring the previous catalog. The owner subsequently upgraded Apliiq to VIP and authorized the API connection. This dated scope supersedes the paused-commerce and free/manual-only statements in historical records. API work is isolated in branch `launch/apliiq-fulfillment-2026-10-14`; the original Desktop checkout and audit worktree remain preserved.

- Bone only: SS3000 crewneck XS–3XL at $52; AFX64CRP cropped hoodie XS–2XL at $55; free domestic shipping. Four garment-only images per product. Three campaign images per product belong to the lookbook, website editorial and marketing, never shopping galleries or product feeds.
- Square hosts checkout through the two verified product payment links. Size selection is required there; a multi-product cart is not implemented. The authorized API release routes newly paid eligible orders to the exact 13 approved Apliiq variants and returns verified shipment tracking to Square. Use a durable submission claim, signed callbacks, an activation cutoff and reconciliation without blind supplier retries. Private label SB-3-161622 is required; woven labels are on hold.
- GA4 and the approved Meta website dataset load only after the appropriate consent. No Purchase event is emitted from a checkout click or return URL. No ad spend, sample purchase, paid test transaction, new subscription, or customer message is authorized.
- User confirmed permanent removal of 25 obsolete Apliiq designs and SB-2-155690. Current two garments/current label and historical orders/local source remain preserved.
- Release through GitHub main to exact Netlify site `275b4115-16bf-42fb-9b36-6bce9bb93608`; retain protections and use the existing owner PR permission only after all required checks pass. Do not claim independent review. Verify source, artifact, live checkout links, feeds and consent behavior after publication.
- Details and remaining external approvals belong in `LAUNCH-2026-10-14.md`. Historical sections below are dated records, not current commerce status.
- Active backend: only `site-preview/server/fulfillment/` and `site-preview/netlify/functions/`. Secrets use new `AHA_` keys in production/functions scope. Preserve original provider APIs and credentials; do not activate them. Existing database migrations are copied byte-for-byte to the active package; only additive new fulfillment tables are authorized. The API activation does not authorize a paid test order, sample purchase, new billing change or customer email.
- Netlify discovers database migrations from the repository root even when the app base is `site-preview`. Keep the new fulfillment migration byte-identical in both `netlify/database/migrations/` and `site-preview/netlify/database/migrations/`; tests enforce this. Use fictitious locations in unit fixtures; the actual location is a production environment setting and is independently verified against Square.

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
