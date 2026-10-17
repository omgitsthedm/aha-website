# After Hours Agenda agent contract

## Collection films — October 17, 2026

The owner asked for short, labeled AI motion from the campaign photos for the hero and lookbook, then set the direction: the star is New York City and its nightlife, seen through a tilt-shift lens from a high angle; garments appear only as sub-second, torso-only shots (Justice, "D.A.N.C.E."), very subtle, no push in or out, nothing bright or polished, as if a drunk cameraman shot it in 1972.

- **What ships:** four silent films of about 8 seconds, one per collection, at 18 fps in `site-preview/public/motion/`. Each cuts five high-angle New York night shots with four garment shots of about half a second. There are three files per film:
  - `<collection>-800.mp4` (640 × 800) for wider screens.
  - `-600.mp4` (480 × 600) for the phone home and collection heroes.
  - `-600t.mp4` for the full-screen phone lookbook (`MotionImage tall`), whose crop keeps only the middle of the frame.
- **Where:** the home hero (Mighty Mick's), the lead photo of each collection in the lookbook and each collection page's hero, through `src/components/MotionImage.astro`. `src/data/motion.json` maps the photo `src` to its film and records every city clip (Pexels ID and creator) and every garment shot (source photo, seed, generator).
- **Behavior** (`src/scripts/motion.ts`): the photo stays the page's main image. The film is added only after load, only while on screen, and never for reduced motion, Data Saver or 2G. A prerendered page waits until it's opened. Every film has a Pause button. While a film plays, its caption reads "<collection> film · New York footage from Pexels · garment shots AI-generated". Keep that label.
- **City footage:** Pexels videos under the Pexels license (free commercial use, editing allowed, no credit required; no implied endorsement by people shown). Avoid close, identifiable faces and Times Square brightness. The shortlist and source URLs are in `site-preview/tools/motion/pexels-sources.tsv`.
- **Garment shots:** LTX-2.3 distilled image-to-video, run locally from a torso crop of a campaign photo. The LTX-2 Community License is free for businesses under $10 million in annual revenue and requires disclosing machine-generated content; the caption does that. Only the first half-second of each take is used, because prints drift later. Every shot was checked frame by frame. Rejected takes: hands over the print, a hem tug that melted the address line, a sway that garbled "insomniac".
- **The look** is applied after generation, so the model never polishes it (`site-preview/tools/motion/look72.py`).
  - The owner's motion direction: 18 fps cadence, and a handheld lurch at constant framing that is never a zoom move.
  - The grade is the fixed post pass from the owner's FW26 Lookbook & Campaign Brief (`~/Desktop/AHA Fall Winter 2026 Lifestyle/FW26 Lookbook & Campaign Brief.md`, section "Post-production"). Its script, filmpost_v3.py, isn't on disk, so `stock()` implements its published numbers: black point 10% with a soft knee to 20% (true blacks, never lifted), 0.45 px softness, a shoulder above 85% at 0.7, saturation 0.90, cool shadows and warm highlights, halation above 88%, grain 2.2% plus 1.8% in the shadows, black held below 4%, and a 12% vignette.
  - Every frame carries the brief's amber seven-segment time stamp. Across each film the hour runs through one night, 18:00 to 04:00. The desktop file has it in the corner; the phone file sets it inward so the phone hero and the full-screen lookbook crops keep it.
  - City shots add a tilt-shift focus band (`city72.py`) at the owner's request, although the brief's stills rule is no bokeh. City shots carry no readable signs or road text (brief rule 8). `film72.py` treats garment shots, and `reel.py` cuts, stamps and encodes.
  - The brief lists stills only; the films came later at the owner's request and follow its grade, stamp and rules.
- **No people, only garments** (owner, October 17: every image on a model focuses on the garment and never expresses a human):
  - Back-view and leaning garment shots are cropped below the head, hair or any sign (`film72.py` top/cx, recorded in `tools/motion/garment-shots.txt`).
  - Every frame of every film was checked with Apple Vision face detection. The only hits are the illustrated boxer in the Mighty Mick's print and specks of city light.
  - Run that check again on any new shot.
- **Rebuilding:** the raw takes, treated shots, Pexels originals, web files and campaign crop masters are kept in `~/Desktop/After Hours Agenda/03 Video Advert/04 Site Films — 2026-10-17/`, because `/tmp` is cleared on restart. The scripts expect the working folder `/tmp/aha-video`; copy the sources back there first. The Desktop toolchain (`03 Video Advert/Production Project/Production/V22/toolchain`) imports far too slowly through iCloud. Clone its weights with `cp -c`, which uses no extra disk, and rebuild the Python environment from the local uv cache. Don't re-download.
- **The Fall 2026 advert (V27–V31) can't go on the site.** Its own source manifest calls it an internal proof of concept. Of the 27 city shots in V31, 24 come from other creators' YouTube videos (downloaded with yt-dlp), 2 have no recorded source, and only 1 (Pexels 8491299) is licensed. Its soundtrack is commercial music (Madeon "Hi!"), and its garment flashes are retired AI concepts that don't match the products for sale. Keep every advert file. Don't publish the film or its city shots without licenses from those creators.

## Torso-only campaign photos — October 17, 2026

The owner's FW26 Lookbook & Campaign Brief (`~/Desktop/AHA Fall Winter 2026 Lifestyle/FW26 Lookbook & Campaign Brief.md`) sets two rules for campaign photos:
- Rule 1: torso only, never a face; hair only as strands at the edge.
- Rule 8: no readable text except the design's own graphic; generic BAR, PIZZA, DELI and OPEN signs are allowed.

- **What changed:** 39 of the 48 campaign photos were re-cropped to torso framing from their lossless originals. Fronts now start at the base of the neck, and backs start below the hood or neckline. The Yikes cropped hoodie set and the six Mighty Mick's photos already started at the neck and are unchanged.
- **Where the originals are:** the launch folders under `~/Desktop/After Hours Agenda/00 Current Drop — Fall 2026/`, and for Pet It Be, `site-preview/tools/images/out/pet-it-be-ss3000-maroon/gen/`.
- **How:** crops come from Apple Vision body-pose joints (neck, shoulders, hips) and face boxes. Insomniac fronts lean toward the left-chest logo so it stays inside the full-screen phone lookbook crop. Files were rebuilt with the catalog engine's campaign profile, keeping each file's IPTC AI marker; `products.json` is unchanged and placeholders were rebuilt. The originals are 1122 × 1402, so crops are enlarged 1.06–1.66× and slightly soft; regenerating at higher resolution would restore detail.
- **Rule 8:** the crops removed Pabst and Budweiser neon, a Simpsons pinball backglass, the Silvercup sign, MTA 7 bullets and an I♥NYC sticker. A "GOOD BEER BAD PEOPLE" wall sign in Yikes crewneck campaign-1 and campaign-3 was painted out to a blank board; that is the only retouch. Generic BAR, DINER and RECORDS neon remain where they're in frame.
- **Portraits removed:** four unused editorial portraits (`hero-her`, `hero-him`, and the two Black Sheep provider renders) showed faces. They were deleted from `site.ts`, `images.json`, the placeholders and `public/images` so they can't come back by accident; git history keeps them.
- **Still unmet:** the existing set doesn't meet the brief's other rules (flash on the lens axis, the amber time stamp, one New York night). That needs regeneration from the house's garment references. New campaign photos must follow the brief's crops before they're published.
||||||| parent of 2833815 (Collection films: tilt-shift New York nights cut with half-second garment shots)

## Collection pages and measuring drawing — October 16, 2026

- **Collection pages:**
  - Every collection has a page at `/shop/<collection>/`, for example `/shop/mighty-micks/`, built by `src/pages/shop/[collection].astro`.
  - Each page has a campaign hero, the pieces, campaign photos with Shop chips, a CollectionPage/ItemList schema and the campaign photo as its share image.
  - Slugs and copy come from `src/data/collections.ts` (`collectionSlug`, `collectionCopy`), the same source as the shop. Give a new collection its copy there.
  - When every piece in a collection has been removed from sale, its page says so.
- **Measuring drawing:** `MEASURE_DIAGRAM` in `server/catalog/garments.mjs` is the how-to-measure drawing on every product page. The live renderer uses the same string; Find my size shows a decorative copy.
- **AI motion clips:** became the collection films on October 17, 2026; see the section above.

## Customer experience, phase 1 — October 16, 2026

The owner asked to "do it all" after reviewing the plan: delivery dates, a fit profile, Buy now, and a live order page. Phase 2 is Square gift cards, as its own release. Phase 3 is customer accounts, saved pieces, drop early access and reviews. It was waiting on Netlify applying migrations, which it did again by October 17.

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
  - **Resolved (checked October 17, 2026):** a later production deploy applied `20261016140000_email_signups`. `NETLIFY_SITE_ID=275b4115-16bf-42fb-9b36-6bce9bb93608 netlify database status --branch production` lists it as applied, with nothing pending. Sign-ups now store addresses. Still never apply DDL by hand (Netlify's rule); confirm with `database status` after each production deploy.
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
