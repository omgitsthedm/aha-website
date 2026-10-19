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
- Shopping images are garment-only; campaign/editorial images remain separate. Campaign imagery is torso-only with no faces and no readable text except a garment’s own graphic (generic environmental signs allowed). Keep accurate AI/archive/provider labels and IPTC AI metadata where supplied. Check crops by eye as well as with Apple Vision: Vision finds no face in a chin without eyes (the six Mighty Mick’s photos were re-cropped to the collar on October 17 for that reason), so review a contact sheet of the top of every campaign photo.
- The collection films use licensed Pexels city footage and locally generated torso garment clips. Keep the photo as the primary image, reduced-motion/data-saver safeguards, pause control, and real/AI caption. Recheck new garment frames for faces. The Fall 2026 advert and its YouTube-sourced footage/commercial music are not publishable.

## Site structure

Set by the owner on October 17, 2026 (“Consolidate: merge Manifesto into The story, trim the FAQ to answers that link out, keep sign-up on Home, Updates and the footer only, make the Lookbook one set per collection, and drop the duplicate Shop link.”):

- The manifesto lives in The story at `/about/#manifesto`. Moved pages are listed in `moved` in `site-preview/src/data/site.ts`; `scripts/finalize.mjs` appends them as 301s to `_redirects` after the Meta feed rewrites that `scripts/feeds.mjs` writes (never replace those), `scripts/serve.mjs` honors them locally, and `scripts/verify-live.mjs` checks both after a release.
- FAQ answers are one or two sentences (140 characters at most, enforced by the artifact test) that link to the page owning the topic.
- One email sign-up form per page: the band on Home, the form on `/updates/`, and a compact footer form everywhere else except `/checkout/` and `/order/`. The footer form reports the first path segment as its source, so every product page keeps the byte-identical footer the live renderer and `tests/live-catalog.test.mjs` require.
- The lookbook shows one three-look set per collection in shop order (`looksFor` in `src/pages/lookbook.astro`); removed products hide their looks, and a set with every look removed hides too.
- The header has one Shop link, the first navigation item.

## Customer accounts, saved pieces, reviews and early access

Built on October 19, 2026 after the owner said "do and fix it all" about the remaining plan (Phase 3).

- **Accounts** (`/account/`, `server/customers/`, `netlify/functions/account-api.mjs`) sign in with passkeys only. No password, name or email address is asked for or stored, only each passkey's public key, so the site sends no account email. Sessions last 90 days in the `__Host-aha_account` cookie, stored as SHA-256 hashes. Deleting an account removes its passkeys, sessions, saved pieces and order links. The account page script does WebAuthn without a library; the server verifies with `@simplewebauthn/server`.
- **Saved pieces:** Save for later on product pages keeps a list in the browser (`aha-saved-v1`). Signing in merges that list into the account, and it syncs while signed in.
- **Orders in an account:** the order page's Add to my account links an order through its signed order link. An order belongs to one account.
- **Reviews** (`/api/reviews`, `server/customers/reviews.mjs`) come only from an order's private link after it ships, one per product per order. Every review waits in Admin → Reviews until the owner approves it, and an edit goes back for approval. Product pages show approved reviews only, fetched at runtime and cached at the CDN until a moderation purges the `reviews-<slug>` tag. Never invent, import or seed reviews. Review-request emails still need the owner's OK.
- **Early access:** `src/data/drops.json` lists `{ slug, earlyAccessAt, releaseAt }` in UTC. Before `releaseAt`, the checkout quote refuses the product unless the shopper is signed in and `earlyAccessAt` has passed. Feeds leave the product out until release, and their CDN copy expires at the release. The product page shows both times and locks Add to bag and Buy now for everyone else. Editing the file needs a deploy; remove an entry after its release.
- **Script budget:** public storefront scripts stay under 65 KB. The private order and account page scripts have their own 12 KB cap (`tests/artifact.test.mjs`).
- **Local testing:** `AHA_LOCAL_ACCOUNTS=1` makes `scripts/serve.mjs` run the real account, review and order-status handlers on an in-memory database (`scripts/local-accounts.mjs`). Playwright turns this on, and `tests/browser/accounts.spec.ts` creates and uses real passkeys with Chrome's virtual authenticator on `localhost`.

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
