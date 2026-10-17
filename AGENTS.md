# After Hours Agenda agent contract

## Collection pages and measuring drawing — October 16, 2026

- **Collection pages:**
  - Every collection has a page at `/shop/<collection>/`, for example `/shop/mighty-micks/`, built by `src/pages/shop/[collection].astro`.
  - Each page has a campaign hero, the pieces, campaign photos with Shop chips, a CollectionPage/ItemList schema and the campaign photo as its share image.
  - Slugs and copy come from `src/data/collections.ts` (`collectionSlug`, `collectionCopy`), the same source as the shop. Give a new collection its copy there.
  - When every piece in a collection has been removed from sale, its page says so.
- **Measuring drawing:** `MEASURE_DIAGRAM` in `server/catalog/garments.mjs` is the how-to-measure drawing on every product page. The live renderer uses the same string; Find my size shows a decorative copy.
- **AI motion clips:** requested but not made. The ElevenLabs creative workspace needs a paid plan for video, and Figma Weave needs the owner's Figma account linked plus per-run cost approval.

## Customer experience, phase 1 — October 16, 2026

The owner asked to "do it all" after reviewing the plan: delivery dates, a fit profile, Buy now, and a live order page. Phase 2 is Square gift cards, as its own release. Phase 3 waits until Netlify applies database migrations again: customer accounts, saved pieces, drop early access and reviews.

- **Delivery estimates:**
  - `src/data/delivery.json` holds production and shipping business days, a buffer, closed dates and the holiday order-by date. `src/scripts/delivery.ts` turns them into "Estimated U.S. arrival" lines.
  - The lines appear on product pages (in space reserved in the page markup), on the bag card and on the order page.
  - Keep the numbers cautious and adjust them from real orders.
- **Fit profile:** "Find my size" on product pages compares a top the visitor owns (chest width and body length, laid flat) with the page's measurement table (`src/scripts/fit.ts`). It suggests a size, and the measurements stay in the browser (`aha-fit-v1`).
- **Buy now:** adds the piece and goes straight to checkout, where browser autofill completes the form. True one-tap Apple Pay or Google Pay on product pages would let the wallet supply the address and re-price the order. That changes the checkout's quote-then-pay design and needs a real-device test, so it hasn't been built.
- **Live order page:**
  - `/order/?o=<square order id>&k=<signature>` is served by `netlify/functions/order-status.mjs` and `server/orders/status.mjs`.
  - It shows Paid → In production → Shipped, tracking and items, but never names, emails or addresses.
  - Links are HMAC-signed with `AHA_ORDER_LINK_SECRET`, or else a key derived from `AHA_SQUARE_WEBHOOK_SIGNATURE_KEY`. Rotating that secret breaks old links.
  - Confirmation and shipment emails include "See your order".
  - `/order/*` is served with noindex and no-referrer headers.
- **Script budget:** the artifact test counts only customer-facing scripts against 65 KB; admin-only scripts have their own 40 KB cap.
- **Gift cards (phase 2):**
  - Square's own eGift shop for this account (`brand.giftCards` in `src/data/site.ts`) sells and emails digital cards and owns their terms. It's linked from the footer and the FAQ.
  - Checkout redeems Square gift cards with the Web Payments gift card field. A card must cover the whole order; split payments aren't supported, and a short balance gets a plain message.
  - It's on unless `AHA_CHECKOUT_GIFT_CARD_ENABLED=false`.

## Email sign-up and storefront fixes — October 16, 2026

The owner instructed: “Build the five fixes and also add an email signup that only collects addresses.”

- **Email sign-up.** A form in the Stay close band (home, about, lookbook, manifesto) and on `/updates/` posts to `/api/updates/subscribe` (`netlify/functions/updates-subscribe.mjs`, `server/updates/signups.mjs`). It stores the lowercased address, the page and the consent wording in `aha_email_signups`.
  - It sends nothing: no confirmation email, and no email provider is connected.
  - Admin → **Email list** shows the addresses, downloads a CSV and removes an address on request. The overview and the weekly digest show counts only.
  - Analytics get a `generate_lead` / `email_signup` / Meta `Lead` event with the page name, never the address.
  - Sending newsletters, or connecting Resend audiences or another email tool, needs the owner's separate instruction. Every email sent must include an unsubscribe link, as the privacy page says.
  - The migration `20261016140000_email_signups` is byte-identical at both discovery paths.
  - **Open issue (October 16, 2026):** Netlify's production deploys of `2416505` (#123) and `840fdef` (#124) logged "No pending database migrations" and didn't apply it; `netlify database status --branch production` still ends at `20261016130000_owner_reports`. Until it's applied:
    - Sign-ups get a plain "couldn't save" reply (HTTP 503) and nothing is stored.
    - The admin and the digest treat the list as empty.
    - The daily health check emails the owner about it.
    - Don't apply the DDL by hand (Netlify's rule). Confirm with `database status` after each production deploy.
- **Storefront.** `/updates/` copy is current, and the privacy page covers sign-ups. Home, shop and lookbook share the collection order in `src/data/collections.ts`, newest drop first; Pet It Be stays last while it is removed from sale. The lookbook hides sets for removed products. The shop has collection jump links, and phones get a quick-add bar on product pages (`initBuyBar` in `src/scripts/cart.ts`).

## Approved Pet It Be launch — October 16, 2026

The owner instructed: “Yes: Pet It Be B1 (cream on cranberry) on the Maroon Independent SS3000 crewneck, XS–3XL, $55, free US shipping, front print 11 inches wide, private label as usual.” The catalog engine created Apliiq artwork 8209339 and design 6211854 (SS3000 product 391, Maroon 480, front 4546, label SB-3-161622 inside neck) and Square item CX5OOOUPF44W4JEZLHPTJG4R with seven variations. The catalog is 16 products / 109 variants. Garment front and print-detail shots are deterministic composites of the exact print master on a recolored blank photo; back, folded and three campaign images are AI-generated from that composite. No paid test order, ad spend or customer message is authorized by this entry.

## Pet It Be removed from sale — October 16, 2026

The owner removed Pet It Be Crewneck — Maroon from sale in the admin. It is off the shop, bag, feeds and checkout, and its Square item is archived. The owner chose to keep it in the code so **Restore to sale** can bring it back. Don't run `catalog retire-sync` for it, and don't delete its Apliiq design 6211854, unless the owner asks.

## Approved The City expansion — October 15, 2026

The owner instructed “Alright let’s upload them for sale” after approving the three Black mockups: Independent SS4500 hoodie, Independent SS3000 crewneck, and Next Level 3601 long sleeve. Publish these alongside the existing Yikes and Insomniac catalog at the existing matching-style prices of $58, $55 and $42, one price across selected sizes, with free domestic shipping. Preserve the approved blue/orange full-back artwork, black negative space and plain fronts. All three supplier records include private label SB-3-161622; woven labels remain on hold. The expansion adds 21 exact Square-to-Apliiq variation mappings, for 13 garment/color options and 88 variants. Each product has four garment-only shopping images and three separate campaign images. Publication must pass the existing checks and exact-site release verification. This scope includes catalog and website publication, not paid test purchases, advertising or additional subscriptions.

## Approved Insomniac expansion — October 15, 2026

The owner approved publishing all eight Insomniac garment/color options alongside Yikes: Independent SS4500 hoodies at $58, Independent SS3000 crewnecks at $55, Next Level 3601 long sleeves at $42, and Comfort Colors 4410 pocket long sleeves at $58. Each style has two approved colors, one price across its available sizes, free domestic shipping, the exact approved front/back artwork, and private label SB-3-161622; woven labels remain on hold. The resulting catalog has ten garment/color options and 67 exact Square-to-Apliiq variation mappings. Each Insomniac option has four garment-only shopping images and three separate campaign images. This expands the historical 13-variant Yikes-only scope below; it does not authorize new purchases or advertising spend.

## Current custom-checkout authorization — October 15, 2026

The owner explicitly instructed: “fix it all, don't stop until someone can load up their cart, and check out.” Restore an AHA-owned multi-product cart and embedded Square checkout in the active `site-preview/` application, including supported configured wallets and Afterpay subject to eligibility. This supersedes the individual-product-link-only behavior below. Preserve prices, the 13 approved Yikes variants, the existing merchant-approved AZ-only 8.1% order tax, free domestic / existing $25 supported international shipping, current private label, privacy controls, and the active durable Square-to-Apliiq webhook. The owner authorized publication of the completed checkout. The active transactional confirmation/shipment outbox may process new verified customer orders; development verification must not send messages. No paid production test, sample, ad spend or customer message is authorized. Use Square Sandbox for non-billable payment verification where available. Do not reactivate old Next.js/provider pipelines. Keep checkout session migrations additive and identical at repository root and active package. Document actual browser/device coverage without claiming every browser version or a genuine paid-order round trip.

## Current tracking policy — owner instruction October 15, 2026

For new visitors, analytics and marketing tracking are on by default and the site does not show an automatic cookie banner. The footer’s Privacy choices continue to offer explicit analytics and marketing opt-outs. Global Privacy Control disables Meta marketing tracking. Tracking events must not include names, email addresses, shipping addresses, payment-card details or other direct customer details. Earlier consent-gated statements are historical implementation evidence, not the current policy.

## Current authorized launch — October 14, 2026

The owner explicitly authorized going live with the first two Yikes! products and retiring the previous catalog. The owner subsequently upgraded Apliiq to VIP and authorized the API connection. This dated scope supersedes the paused-commerce and free/manual-only statements in historical records. API work is isolated in branch `launch/apliiq-fulfillment-2026-10-14`; the original Desktop checkout and audit worktree remain preserved.

- Bone only: SS3000 crewneck XS–3XL at $52; AFX64CRP cropped hoodie XS–2XL at $55; free domestic shipping. Four garment-only images per product. Three campaign images per product belong to the lookbook, website editorial and marketing, never shopping galleries or product feeds.
- Square hosts checkout through the two verified product payment links. Size selection is required there; a multi-product cart is not implemented. The authorized API release routes newly paid eligible orders to the exact 13 approved Apliiq variants and returns verified shipment tracking to Square. Use a durable submission claim, signed callbacks, an activation cutoff and reconciliation without blind supplier retries. Private label SB-3-161622 is required; woven labels are on hold.
- GA4 and the approved Meta website dataset load by default for new visitors, subject to the footer Privacy choices and Global Privacy Control blocking Meta marketing. No Purchase event is emitted from a checkout click or return URL. No ad spend, sample purchase, paid test transaction, new subscription, or customer message is authorized.
- User confirmed permanent removal of 25 obsolete Apliiq designs and SB-2-155690. Current two garments/current label and historical orders/local source remain preserved.
- Release through GitHub main to exact Netlify site `275b4115-16bf-42fb-9b36-6bce9bb93608`; retain protections and use the existing owner PR permission only after all required checks pass. Do not claim independent review. Verify source, artifact, live checkout links, feeds and consent behavior after publication.
- Details and remaining external approvals belong in `LAUNCH-2026-10-14.md`. Historical sections below are dated records, not current commerce status.
- Active backend: only `site-preview/server/fulfillment/` and `site-preview/netlify/functions/`. Secrets use new `AHA_` keys in production/functions scope. Preserve original provider APIs and credentials; do not activate them. Existing database migrations are copied byte-for-byte to the active package; only additive new fulfillment tables are authorized. The API activation does not authorize a paid test order, sample purchase, new billing change or customer email.
- Netlify discovers database migrations from the repository root even when the app base is `site-preview`. Keep the new fulfillment migration byte-identical in both `netlify/database/migrations/` and `site-preview/netlify/database/migrations/`; tests enforce this. Use fictitious locations in unit fixtures; the actual location is a production environment setting and is independently verified against Square.

This custom-domain project keeps the After Hours Agenda brand. Never substitute an agency or future client's identity. The user corrected the initial rebrand direction on October 9, 2026. Only abstract projects use LFNYC branding.

## Catalog engine (October 16, 2026)

New products, prices and catalog checks go through the catalog engine, never ad-hoc scripts: `cd site-preview && npm run catalog -- <import|generate|verify|margin|plan|apply|explain>`. The shared skill `.agents/skills/aha-catalog/SKILL.md` (also linked at `.claude/skills`) is the runbook for Codex and Claude Code. `catalog/ledger.json` ties every product to its Apliiq design and Square item; `server/fulfillment/catalog.mjs` is generated from it. Apliiq creates are intent-guarded and never retried blindly.

## Live catalog, operations and platform (October 16, 2026)

- **Publishing without a site build.** `npm run catalog -- publish-live <slug>` uploads an applied product's images and then the product itself to Netlify Blobs, through the admin automation API (production only, with `ADMIN_AUTOMATION_TOKEN`). Its page, images, feeds, sitemap, bag and both allow lists pick it up immediately, from `server/catalog/` and the `catalog-*` functions. Built files and built variations always win. `ship` runs it after its checks pass. Commit the product afterwards so the next build serves the same URLs statically; that commit doesn't need its own release.
- **Removing products.**
  - Admin → Products → **Remove from sale** takes a product off the shop, product page, bag, feeds and checkout at once, with no site build. It is listed in Netlify Blobs; see `server/catalog/retired.mjs` and `server/admin/catalog-actions.mjs`.
  - Its Square item is archived. Paid orders still reach Apliiq, because the fulfillment allow list keeps every variation.
  - **Restore to sale** undoes it.
  - **Delete Apliiq design** is permanent. It works only after removal, only when no unshipped order uses the design, and only with the slug typed to confirm.
  - `npm run catalog -- retire-sync` then deletes removed products from the code, so the next build drops their static pages. It skips any product with unshipped orders.
- **Runtime product pages** are rendered by `server/catalog/render.mjs`. `tests/live-catalog.test.mjs` requires them to be byte-identical to Astro's build for every built product. Change the renderer whenever `src/pages/shop/[product].astro`, `ProductCard.astro` or `ProductImage.astro` change.
- **Order hold.** Paid orders reach Apliiq only after `AHA_FULFILLMENT_HOLD_MINUTES` (default 60). The hourly run re-reads Square first, so anything refunded or cancelled inside the window is held.
- **Owner reports.** A daily health check (13:00 UTC) emails only when Square, the feeds, orders, email or publishing need a person. A weekly digest goes out Mondays at 13:30 UTC. Both are recorded in `aha_owner_reports` and shown on the admin overview.
- **Deploy skips.** The Netlify `ignore` command (`scripts/netlify-ignore.mjs`) skips builds for commits that only touch tooling, tests, catalog data or docs.
- **Client platform.** Store identity and providers live only in `site-preview/client.config.json`, validated by `npm run client:check` and `tests/platform.test.mjs`. That file holds the site origin, the exact Netlify site ID, the pinned Square version, the private label, analytics IDs and brand colors. A new LiFi client store starts from a copy of this repository with that file replaced. Only Square and Apliiq have connectors (`server/platform/client.mjs`); a config naming another provider is refused until its connector is built.
- **Cost.** Every engine run logs its time and provider calls; `npm run catalog -- usage [days]` totals them.
- **OpenAI product feed.** `/feeds/openai.jsonl.gz` is in OpenAI's JSON Lines format, built and served live like the Google and Meta feeds (search only, no ChatGPT checkout). `.github/workflows/openai-feed.yml` pushes it daily by SFTP once the owner's OpenAI merchant account exists and the `OPENAI_SFTP_*` secrets are set; until then it does nothing.
- **AI image labels.** Site and feed images keep their IPTC `trainedAlgorithmicMedia` tags. Square strips all metadata from its own copies, which appear only in the Square dashboard.
- **MCP.** `.mcp.json` (Claude Code) and `.codex/config.toml` (Codex) both add the read-only Astro docs server. Provider writes go only through the catalog engine.

## Source and scope

- Working checkout (October 16, 2026): `/Users/davidmarsh/Code/LiFi NYC/Clients/After Hours Agenda/aha-website`, a fresh clone of `main` outside iCloud. Work here, not in iCloud-synced Desktop or Documents folders; sync creates `* 2.*` duplicate files.
- Older checkouts (preserved, not active): `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website` (branch `release/seo-domination-2026-10-08`) and the Codex session clone under `/Users/davidmarsh/Documents/Codex/2026-10-14/o-x20/work/aha-launch-source`.
- Pushing: the LiFi push guard only accepts the registered checkout (`ai-system where "After Hours Agenda"` → the Desktop `Website` folder), so it refuses pushes from the working clone. Fetch the branch into the Desktop checkout and push from there. Use literal paths; the guard also refuses shell variables. Never check out or change the Desktop checkout's own branch:
  `git -C "/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website" fetch "/Users/davidmarsh/Code/LiFi NYC/Clients/After Hours Agenda/aha-website" <branch>:<branch>`
  then `git -C "/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website" push -u origin <branch>`.
- Active app: `site-preview/` (Astro). The repository-root Next.js app is inactive.
- GitHub: `omgitsthedm/aha-website`; production branch: `main`.
- Exact Netlify site: `275b4115-16bf-42fb-9b36-6bce9bb93608`; primary host: `https://afterhoursagenda.com`.
- Read `SOURCE_OF_TRUTH.md`. Confirm physical Git root and `git status --short` before edits. Preserve unrelated work and the original checkout.

The owner explicitly instructed “yup push it all live, document it and leave it the folder” on October 9, 2026. This authorizes the reviewed static migration and necessary release fixes through GitHub main and the exact Netlify site. Ruleset 20717491 normally requires one independent review; it already grants user 55168770 (omgitsthedm) a pull-request-only exception. For this release only, use that existing permission after all nine named checks pass; never change protections or fabricate a review. Auto-merge is disabled. Root netlify.toml selects base site-preview, then Netlify reads site-preview/netlify.toml: keep both configurations aligned. A merged commit or successful local build is not proof of a live release. No DNS/domain change, provider/data mutation, payment, message or form submission is authorized. No global installs or shared configuration edits. Ports 48378/48379 only; use installed Google Chrome. Return to preview-first scope for new work after this release.

## Design and content

Use AHA's current `app/globals.css`, Poppins weights from `app/layout.tsx`, `lib/content/brand-copy.ts`, the canonical `components/ui/SheepMark.tsx` artwork and `data/brand-imagery.json`. The later source contract takes precedence over conflicting July design prose: paper/ink/rose, Poppins 400/700/900, hairline frames, warm plain language and no invented city-origin claims. New preview tokens live in `site-preview/src/styles/tokens.css`.

Never theme a feature or write customer-facing copy that plays off the brand name (no “after hours” modes, night or time-of-day puns, or “agenda” wordplay); the name appears only as the name. The owner set this rule on October 16, 2026.

New orders are paused. Never fabricate product availability, future release dates, reviews, revenue, conversion or search results. Caption AI campaign concepts and previous-run renders accurately. Preserve existing-order terms. The contact enhancement only prepares a local email; no backend delivery or automatic signup is implied.

## Validation

From `site-preview/` on Node 24.21.0: `npm run check`, `npm run test:e2e`, `npm audit`. Build and visually inspect before any draft deploy. Artifact tests reject wrong-business content, transactions and secrets. Run both preview and production modes before release. Hosted checks must verify exact source/hash, routes, headers, ownership files and indexing. `NEEDS-APPROVAL.md` records the approved scope and remaining verification sequence.

## Protected original application

Treat `app/api/`, `lib/square/`, `lib/apliiq/`, `lib/printful/`, `lib/commerce/`, checkout, webhooks, provider mappings and database operations as high risk. Never manufacture an order/payment/customer/refund/fulfillment or send email during verification. Handle required credentials only within explicit authorization; do not print, commit or publish secrets. Preserve all existing provider accounts and data.

Original validation commands remain `npm run lint`, `npm run typecheck`, `npm test`, `npm run validate:all`, `npm run build`, `npm run verify:netlify-site`, `LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live` and `npm run verify:commerce-readiness:netlify`. These do not authorize transactional probes or live mutations. Detailed original design/commerce/database references remain under `docs/` and `db/`; dated handoffs are historical evidence, not current release truth.
