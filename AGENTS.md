# After Hours Agenda operating contract

This is the current operating contract. It replaces dated launch narratives and does not itself authorize production writes, provider changes, payments, customer messages, ad spend, or publishing.


## Non-negotiable customer-copy rule

Owner instruction, October 20, 2026: **NO REFERENCE TO “AFTER HOURS” OR “AGENDA” IN COPY.**

- Never use either term, the full brand name, or their meanings as a creative hook, pun, metaphor, headline, slogan, CTA or campaign theme. Do not infer nightlife, late nights, after dark, off-the-clock, schedules or calendars from the brand name.
- This applies to all customer-facing website, product, SEO, email, advertising, social and campaign copy, including mockups and drafts. It is a mandatory rejection criterion, not an optional tone preference.
- Write for the customer about the clothing: artwork, styling, fit, fabric, construction, quality and useful purchase information. No copy addressed to the director or about the internal production workflow.
- The exact brand name is identification only: the wordmark, required legal attribution and factual metadata. It is never permission for brand-name wordplay or themed marketing prose.
- Approved artwork, product identifiers and factual color/design names are not rewritten under this copy rule. This rule authorizes no catalog, provider or production changes.
- Before presenting any draft, read all its customer-facing copy against this rule. Rewrite violations before showing them to the owner.


## Website visual direction (October 20, 2026)

The owner approved the photography-first website: Paper #FAFAFA, Ink #1A1A1A and Rose #FF6B6B, with accessible Rose text #CE3D56. No pink UI grounds. Preserve Poppins, JetBrains Mono, the official sheep and hairline frames. The homepage headline is “GET COMFORTABLE MAKING AN IMPRESSION.” and its primary CTA is “Shop it all”. No decorative arrows, Unicode arrows or generic arrow icons in customer-facing UI. Use clear text and verified custom assets. Editorial photography is separate from garment-only shopping galleries; never alter approved print artwork. Treat older origami and brand-name wordplay directions as superseded by these explicit owner decisions.

The lookbook headline is “Out & About It.” Product mockups use one white studio background, not a mix of grey, cream and white. The owner authorized conventional background masking on October 20: preserve the supplied garment and print pixels, retain originals, inspect every view and check difficult edges before publishing. Fabric-filled close-ups keep their actual fabric color and texture. Version replacement image URLs so returning customers do not keep cached older backgrounds.

Link previews use the current 1200×630 JPEGs in `site-preview/src/data/social-cards.json`, with content-hashed filenames. Regenerate with `tools/images/social-cards.mjs` after approved garment or campaign changes, review every card and preserve exact garment/color matches. Homepage, shop, lookbook, story, current products and design pages have dedicated cards; support pages use the current home card. Keep Open Graph and Twitter metadata and the runtime product renderer aligned. Social-platform caches are external; new image URLs avoid reusing old image bytes.

The owner specifically requested the footer attribution “created by Little Fight NYC” with the official Fight Orange (#F97316) tugboat and a link to littlefightnyc.com. This limited credit does not replace AHA’s identity or extend orange into the storefront palette.

## Source, application, and release

- Work in the current isolated task checkout only when assigned. The primary working clone is `/Users/davidmarsh/Code/LiFi NYC/Clients/After Hours Agenda/aha-website`; the registered push checkout is `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website`. Preserve its branch and use it only for the guarded fetch-and-push path when a separately authorized release requires it.
- The active application is `site-preview/` (Astro). The repository-root Next.js application is historical source and must not be reactivated for storefront or checkout work.
- Repository: `omgitsthedm/aha-website`; production branch: `main`. The exact Netlify site is `275b4115-16bf-42fb-9b36-6bce9bb93608` at `https://afterhoursagenda.com`.
- Read `SOURCE_OF_TRUTH.md` for the dated verification snapshot and remaining work. Confirm future live claims from the exact published deploy, matching `/release.json`, and GitHub `main`; a local build, merge, branch, or document is not release proof.
- New changes are preview-first. Finish implementation, Node 24 checks, and local visual review before a hosted preview or release. Do not publish, push, commit, or deploy unless the task explicitly authorizes it.

## Brand, customer content, and creative assets

- The customer-facing business is **After Hours Agenda**. Do not substitute agency/client identities, invented city-origin claims, other businesses' details, or unsupported social channels. There is no TikTok work or account in scope.
- Preserve the established paper/ink/rose system, Poppins 400/700/900, JetBrains Mono, black-sheep mark, hairline frames, and warm plain clothing-brand voice.
- Shopping images are garment-only; campaign/editorial images remain separate. Campaign imagery is torso-only with no faces and no readable text except a garment’s own graphic (generic environmental signs allowed). Keep accurate AI/archive/provider labels and IPTC AI metadata where supplied. Check crops by eye as well as with Apple Vision: Vision finds no face in a chin without eyes (the six Mighty Mick’s photos were re-cropped to the collar on October 17 for that reason), so review a contact sheet of the top of every campaign photo.
- The collection films use licensed Pexels city footage and locally generated torso garment clips. Keep the photo as the primary image, reduced-motion/data-saver safeguards, pause control, and real/AI caption. Recheck new garment frames for faces. A frame on screen at load gets its film layer immediately, with the photo's own file as the poster (`src/scripts/motion.ts`). Chrome then times that layer's LCP by the poster, so the film's later first frame can't make LCP late (it did in CI on PR #134). Keep it that way. The Fall 2026 advert and its YouTube-sourced footage/commercial music are not publishable.

## Site structure

Set by the owner on October 17, 2026 (“Consolidate: merge Manifesto into The story, trim the FAQ to answers that link out, keep sign-up on Home, Updates and the footer only, make the Lookbook one set per collection, and drop the duplicate Shop link.”):

- The manifesto lives in The story at `/about/#manifesto`. Moved pages are listed in `moved` in `site-preview/src/data/site.ts`; `scripts/finalize.mjs` appends them as 301s to `_redirects` after the Meta feed rewrites that `scripts/feeds.mjs` writes (never replace those), `scripts/serve.mjs` honors them locally, and `scripts/verify-live.mjs` checks both after a release.
- FAQ answers are one or two sentences (140 characters at most, enforced by the artifact test) that link to the page owning the topic.
- One email sign-up form per page: the band on Home, the form on `/updates/`, and a compact footer form everywhere else except `/checkout/` and `/order/`. The footer form reports the first path segment as its source, so every product page keeps the byte-identical footer the live renderer and `tests/live-catalog.test.mjs` require.
- The shop is ordered by garment style: cropped hoodies and T-shirts lead, then long sleeves, crewnecks, hoodies and beanies. The first seven light layers occupy the desktop's first two rows. Live additions join their garment style; they do not jump ahead in a separate "Just added" group. Filters use the same shared garment order.
- The lookbook shows one three-look set per apparel collection (`looksFor` in `src/pages/lookbook.astro`), without location tags. The owner removed the entire beanie knitwear section from this page; beanies remain for sale. Removed products hide their looks, and a set with every look removed hides too.
- The header has one Shop link, the first navigation item.

## Customer accounts, saved pieces, reviews and early access

Built on October 19, 2026 after the owner said "do and fix it all" about the remaining plan (Phase 3).

- **Accounts** (`/account/`, `server/customers/`, `netlify/functions/account-api.mjs`) sign in with passkeys only. No password, name or email address is asked for or stored, only each passkey's public key, so the site sends no account email. Sessions last 90 days in the `__Host-aha_account` cookie, stored as SHA-256 hashes. Deleting an account removes its passkeys, sessions, saved pieces and order links. The account page script does WebAuthn without a library; the server verifies with `@simplewebauthn/server`.
- **Saved pieces:** Save for later on product pages keeps a list in the browser (`aha-saved-v1`). Signing in merges that list into the account, and it syncs while signed in.
- **Orders in an account:** the order page's Add to my account links an order through its signed order link. An order belongs to one account.
- **Reviews** (`/api/reviews`, `server/customers/reviews.mjs`) come only from an order's private link after it ships, one per product per order. Every review waits in Admin → Reviews until the owner approves it, and an edit goes back for approval. Product pages show approved reviews only, fetched at runtime. Approving, rejecting or editing a published review purges the `reviews-<slug>` tag, and the CDN copy expires within ten minutes even if a purge fails (the admin says when it did). Saved pieces published live since the last deploy, or removed from sale, come from `/api/catalog/live` on the account page. Never invent, import or seed reviews. Approve every genuine review, positive or negative (the FTC's consumer-review rule); the Reviews page says so.
- **Early access:** `src/data/drops.json` lists `{ slug, earlyAccessAt, releaseAt }` in UTC. Before `releaseAt`, the checkout quote refuses the product unless the shopper is signed in and `earlyAccessAt` has passed. Feeds leave the product out until release, and their CDN copy expires at the release. The product page shows both times and locks Add to bag and Buy now for everyone else. Editing the file needs a deploy; remove an entry after its release.
- **Script budget:** public storefront scripts stay under 65 KB. The private order and account page scripts have their own 12 KB cap (`tests/artifact.test.mjs`).
- **Local testing:** `AHA_LOCAL_ACCOUNTS=1` makes `scripts/serve.mjs` run the real account, review and order-status handlers on an in-memory database (`scripts/local-accounts.mjs`). Playwright turns this on, and `tests/browser/accounts.spec.ts` creates and uses real passkeys with Chrome's virtual authenticator on `localhost`.

## Customer emails: bag reminders and review requests

Approved by the owner on October 19, 2026 ("yes" to abandoned-cart and review-request emails; mailing address "12415 N 69th Drive, Peoria, Arizona 85381", stored as `client.postalAddress` in `site-preview/client.config.json`). The owner also decided that free returns stay.

- **Bag reminder** (`server/notifications/customer-emails.mjs`): one email, three hours after a checkout is quoted and not paid. Sent only when the shopper's marketing choice was on at checkout (off for Privacy choices opt-outs and Global Privacy Control), nothing was bought since, no reminder went to that address in 30 days, and the address hasn't unsubscribed. Checkouts older than three days are skipped. The "Back to your bag" link (`/checkout/?bag=VARIATION:QTY,…`) refills the bag on any device.
- **Review request:** one email per order, ten days after its shipping email, unless a review already exists. It links to the order page's review form (`#leave-a-review`).
- **Neither email** covers anything from before its program started (`aha_email_programs`, set when migration `20261019120000_customer_emails` ran). Both are queued by the hourly `notification-dispatch` run and go out through Resend on the `marketing` stream.
- **Every customer email** carries the postal address, a reason line, an unsubscribe link and RFC 8058 one-click headers (`List-Unsubscribe`, `List-Unsubscribe-Post`). A customer email with no working unsubscribe link is never sent.
- **Unsubscribe links** are signed per notification row, so no address appears in a URL. Unsubscribing (`/unsubscribe/`, `/api/email/unsubscribe`) stores only a SHA-256 hash of the address, stops both emails, and removes the address from the email sign-up list. Receipts and shipping emails continue.
- **Kill switch:** `AHA_CUSTOMER_EMAILS_ENABLED=false` stops both emails, including ones already queued. Order emails still need `AHA_ORDER_EMAIL_ENABLED=true`.
- **Checked again at send time:** the kill switch, an unsubscribe, and whether the shopper has since bought (bag reminder) or reviewed (review request). A row that no longer qualifies is closed without sending (`last_error_code` `customer_emails_disabled`, `suppressed` or `no_longer_due`).
- **Not authorized:** newsletters or any other bulk send. Those need the owner's separate instruction.

## Products off sale, crawlers and dates

Fixed on October 19, 2026 after a site audit the owner asked for ("do it all"):

- **Off sale but kept in code:** `src/data/off-sale.json` lists products removed from sale in the admin that stay in the code (Pet It Be; the owner chose not to run `retire-sync`). Builds leave them out of the sitemap, llms.txt and the built feeds. If the admin's removed list can't be read, `currentCatalog` reports `retiredKnown: false` and uses this list instead, so feeds, checkout and pages keep them off sale; `/api/catalog/live` says `known: false`, and retire-sync gets a 503. Their pages are `noindex` with `Discontinued` structured data, and their cards, look sets, collection groups and jump links are built hidden, so visitors without JavaScript don't see them. A collection with nothing on sale has a `noindex` page that says so.
- **Restoring:** "Restore to sale" in the admin shows the product again at once: pages reveal a restored piece and its buy form only when the live state says `known: true` (`src/scripts/catalog-state.ts`, `src/scripts/cart.ts`). Take the slug off `off-sale.json` at the next deploy. When removing a product in the admin, add its slug here at the next deploy. The local server treats the list as removed unless `AHA_LOCAL_RETIRED` says otherwise.
- **Live renderer:** product pages render from an on-sale product's page (`catalog-product.mjs`), and off-sale renders get the same `noindex` tag as the build.
- **Dates:** sitemap `lastmod`, llms.txt "Updated" and `release.json` `reviewed` use the built commit's date, so they're current and identical on every machine.
- **Crawlers:** robots.txt welcomes search and shopping crawlers (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Google) and keeps blocking AI training crawlers (GPTBot, ClaudeBot). Google-Extended stays allowed.
- **Structured data:** every product offer carries delivery time (from `src/data/delivery.json`) and the 30-day free-return policy (`server/catalog/offer-terms.mjs`, shared by the build and the renderer).
- **Help page:** it's "Questions" in the header and "Common questions" everywhere else, and `/faq/` carries `FAQPage` markup built from `answers` in `src/data/site.ts`.
- **Google tag and the CSP:** since GA4 was linked to Google Ads, gtag also sends each hit to `https://www.google.com/g/collect`. Production `connect-src` allows that path only (`scripts/security-headers.mjs`); before October 19 the policy blocked it with a console error on every page.
- **Lighthouse Best Practices:** 56–61 on live pages before that fix. A full report on October 19 traced it to the Meta pixel (its `fr` third-party cookie, and Chrome's FencedFrame deprecation inside the Partytown sandbox that hosts it) and to the blocked Google hit above. The pixel's share is the cost of the owner's default-on tracking choice.

## Blanks, print method and the founder story

Added on October 19, 2026 at the owner's request ("print method and blank names from Apliiq … here's the founder story attached"):

- **Blank:** every product in `src/data/products.json` names its blank (`blank`), confirmed against the catalog records and Apliiq's catalog: Independent Trading Co. SS3000, SS4500 and AFX64CRP, Comfort Colors 4410 and Next Level 3601. New products get it from `catalog/blanks/<code>.json`.
- **Print method:** `printMethod` appears only where a record shows it. Mighty Mick's and Pet It Be are DTG (Apliiq service `dtgprint`). The other designs' methods are only visible in the signed-in Apliiq dashboard, so their pages say "Printed to order in the United States" without naming a method. The catalog engine sets `printMethod` for new designs whose placements all use `dtgprint`. Add it for the others only after reading the design in Apliiq.
- **Founder story:** The story (`/about/#founder`) comes from David Marsh's 2013 interview "Hit the Ground Running, Episode 1" in the brand archive. Keep it to what the interview says. Don't publish the video (it shows faces), don't name customers, and don't name the TV appearance's celebrity.

## Apple Pay and Google Pay on product pages

Built on October 19, 2026 at the owner's request ("Do this task here: One-tap Apple Pay / Google Pay on product pages"):

- **Flow** (`initExpress` in `src/scripts/cart.ts`):
  1. Once a size is chosen, the page loads `/api/checkout/config` and Square's script, and shows the wallets production has switched on.
  2. While the shopper picks an address in the wallet sheet, `/api/checkout/estimate` prices it from what the wallet shares (country, region, postal code, city). It uses the same Square calculation as the quote and stores nothing.
  3. After approval, the page quotes the wallet's full address through `/api/checkout/quote` and pays through `/api/checkout/pay`: the same durable session, signed callbacks and fulfillment hold as the bag.
- **Safeguards:**
  - The payment goes through only if the quote's total equals the total the sheet showed. Otherwise nothing is charged and the shopper is asked to tap again.
  - Each attempt is saved in `aha-pending-express-v1` before paying. After a reload or a lost response, the page follows it through `/api/checkout/status` and offers no wallet until it settles, so it is never paid twice.
  - The shopper's bag is left alone.
- **Never offered** for products off sale (their form is replaced first; a piece restored in the admin gets the wallets back) or for drops not yet open to everyone. The estimate endpoint applies the same sale list and early-access locks as the quote.
- **Script budget:** public storefront JavaScript was 64,794 bytes of its 65,000-byte cap after this, so the next addition needs a trim first.

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
