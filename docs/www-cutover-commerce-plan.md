# After Hours Agenda WWW Cutover and Commerce Readiness Plan

Date: 2026-07-08
Owner lane: Codex primary, Claude Code verifier
Risk tier: Tier 3 live commerce
Status: Planning artifact only. No push, deploy, DNS, secret, checkout, order, fulfillment, or production data change is authorized by this document.

## Executive Read

The new custom AHA storefront is not ready for a safe `www.afterhoursagenda.com` flip today.

The storefront itself builds and the Netlify `.netlify.app` site is restored, but the production operations path is not ready yet:

- `www.afterhoursagenda.com` currently resolves through Cloudflare to Square/Weebly infrastructure, not Netlify.
- The Netlify project `afterhoursagenda` has no custom domain attached.
- The Netlify project is not Git-linked and recent production deploys are manual, not commit-backed.
- `prevent_non_git_prod_deploys` is still false.
- Netlify production environment variables returned no configured variables by name-only query.
- The current app creates Square-hosted checkout payment links, but Printful order fulfillment is not proven end to end.
- The app has Printful helper clients, but no verified post-payment Printful order creation or webhook workflow.

The migration should be treated as a release program with a go/no-go gate, not a DNS-only task.

## Verified Current State

### Repo

- Canonical visible path: `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website/aha-website`
- Resolved Git root: `/Users/davidmarsh/Code/LiFi NYC/Clients/After Hours Agenda/Website/aha-website`
- Remote: `https://github.com/omgitsthedm/aha-website.git`
- Current branch: `feature/uiux-doctrine-commerce-hardening`
- Local branch contains unpushed storefront UX doctrine work and this cutover planning artifact until David approves the next push/PR path.
- `agency-status` at planning start: AHA `dirty=1` from this uncommitted plan and `unpushed=1`; unrelated Hair By Rachel remains dirty.

### Netlify

- Target site id: `275b4115-16bf-42fb-9b36-6bce9bb93608`
- Site name: `afterhoursagenda`
- Netlify URL: `https://afterhoursagenda.netlify.app`
- Admin URL: `https://app.netlify.com/projects/afterhoursagenda`
- Current `custom_domain`: `null`
- Current `build_settings`: `{}`
- Current `prevent_non_git_prod_deploys`: `false`
- `npm run verify:netlify-site`: passes target identity, warns site is not Git-linked.
- Recent deploys are `commit_ref: null`, `branch: null`, `commit_url: null`.

### DNS and HTTP

Observed 2026-07-08:

- `afterhoursagenda.com` A record: `199.34.228.181`
- `www.afterhoursagenda.com` CNAME: `afterhoursagenda.com`
- `www.afterhoursagenda.com` response headers include `server: cloudflare` and `x-host: ...weebly.net`
- `afterhoursagenda.netlify.app` serves via Netlify and returns the restored AHA storefront.

Interpretation: the public custom domain is still on Square/Weebly-backed hosting through Cloudflare. Netlify is not yet serving the custom domain.

## Source References

- Netlify says to add the custom domain to the Netlify project before configuring external DNS: https://docs.netlify.com/manage/domains/get-started-with-domains/
- Netlify external DNS docs note that assigning `www` or the apex may cause Netlify to add both names, so both apex and `www` need planned handling: https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/
- Netlify build settings require continuous deployment linkage to a Git repository; missing build settings indicate continuous deployment may not be configured: https://docs.netlify.com/build/configure-builds/overview/
- Netlify environment variables are the correct place for API keys and deploy-context-specific values: https://docs.netlify.com/build/environment-variables/overview/
- Square Checkout API `CreatePaymentLink` uses `ORDERS_WRITE`, `ORDERS_READ`, and `PAYMENTS_WRITE`: https://developer.squareup.com/docs/oauth-api/square-permissions
- Square Sandbox is the safe payment test path. Sandbox and production credentials cannot be mixed: https://developer.squareup.com/docs/devtools/sandbox/overview
- Printful V2 requires a valid private token and supports webhook-driven order updates and tracking: https://developers.printful.com/docs/v2-beta/
- Baymard product-page research shows product pages are the core purchase decision surface and that mobile PDP UX is still weak across many ecommerce sites: https://baymard.com/blog/current-state-ecommerce-product-page-ux
- Baymard apparel research calls out incomplete size, fit, returns, loyalty, reviews, and delivery information as central apparel ecommerce decision problems: https://baymard.com/blog/apparel-and-accessories-quantitative-ux-insights-2026

## Required Access and Key Readiness

Do not paste secrets into chat or Git. Set secrets in Netlify UI or CLI only.

| Area | Needed | Current evidence | Status |
| --- | --- | --- | --- |
| Netlify auth | Access to Little Fight NYC team and site `afterhoursagenda` | CLI authenticated as `info@afterhoursagenda.com`; site API readable | Present |
| Netlify Git link | `omgitsthedm/aha-website`, production branch `main` | `build_settings: {}` and folder not linked | Missing |
| Netlify domain | `www.afterhoursagenda.com` and apex attached to target site | `custom_domain: null` | Missing |
| Netlify env vars | Production and deploy-preview secrets | name-only query returned zero env vars | Missing |
| Square production token | token valid for production and target seller/location | `.env.example` declares it; Netlify missing | Needs setup |
| Square permissions | `ITEMS_READ`, `ORDERS_READ`, `ORDERS_WRITE`, `PAYMENTS_WRITE`; optionally `MERCHANT_PROFILE_READ` for location verification | Checkout docs require order/payment permissions; catalog code needs item read | Needs confirmation |
| Square app/location | `SQUARE_APPLICATION_ID`, `SQUARE_LOCATION_ID`, `SQUARE_API_VERSION` | `.env.example` declares these | Needs setup |
| Square sandbox | sandbox app, sandbox token, sandbox location, sandbox catalog or small test product | current code hardcodes production Square base URL | Needs implementation before safe checkout test |
| Printful token | private token or OAuth token with store access | `.env.example` declares token; Netlify missing | Needs setup |
| Printful store ID | target store ID | `.env.example` declares store ID; Netlify missing | Needs setup |
| Printful webhooks | order and shipment events to custom endpoint | no app endpoint observed | Missing |
| DNS control | Cloudflare or registrar access for current A/CNAME records | current DNS resolves through Cloudflare to Weebly | Needs owner access |

## Key Technical Gaps

### 1. Netlify is not safe enough for production cutover yet

Before DNS moves, Netlify must be repaired:

- Link the exact Netlify project to GitHub repo `omgitsthedm/aha-website`.
- Set production branch to `main`.
- Confirm build command `npm run build`.
- Confirm publish output `.next` with `@netlify/plugin-nextjs`.
- Set all required environment variables in Netlify.
- Enable non-Git production deploy blocking if Netlify plan/UI allows it.
- Keep `npm run verify:netlify-site` as a pre-deploy gate.
- Keep `npm run verify:netlify-live` as a post-deploy gate.

### 2. Checkout creates Square payment links but fulfillment is not proven

Current code path:

- `/api/checkout` accepts cart items.
- It creates a Square-hosted payment link through `/v2/online-checkout/payment-links`.
- It asks Square for shipping address.
- It redirects back to `/order-confirmed`.

Known gap:

- Redirect to `/order-confirmed` is not proof of payment or fulfillment.
- There is no verified Square webhook handler to confirm paid orders.
- There is no verified Printful draft-order creation and confirmation after payment.
- There is no observed fulfillment retry/dead-letter path.

### 3. Printful is present as helpers, not a complete fulfillment system

Current code has:

- Printful API client.
- Size guide helper.
- Availability helper.
- Mockup helper.
- Shipping rate helper.

Current code does not appear to have:

- Printful order creation after Square payment.
- Printful order confirmation.
- Printful webhook receiver.
- Shipment tracking sync back to customer-facing order status.
- Mapping table from Square catalog object IDs to Printful variant IDs.

## Recommended Target Architecture

### Keep Square as payment and source of paid order truth

Use Square-hosted checkout for payment until a stronger native checkout path is justified. It is lower PCI burden and keeps buyer trust high.

Minimum required:

- Catalog read from Square.
- Payment link creation from cart.
- Square webhook verification for payment/order completion.
- Server-side order status persistence or durable log.

### Use Printful as fulfillment and shipment truth

Minimum required:

- Square paid-order webhook triggers a fulfillment job.
- Fulfillment job maps each Square line item to Printful variant or external variant.
- Create Printful draft order.
- Confirm Printful order only after payment status is valid.
- Store Printful order ID against Square order ID.
- Subscribe to Printful order/shipment webhooks.
- Send or expose tracking when Printful shipment updates arrive.

### Use Netlify as storefront and serverless integration host

Minimum required:

- Netlify Functions or route handlers for checkout and webhooks.
- Environment variables in Netlify, not Git.
- Site linked to GitHub for reproducible production deploys.
- Production deploy only from reviewed `main`.

## Migration Phases

### Phase 0: Freeze and Evidence

Goal: know exactly what exists before touching DNS.

Actions:

- Export or screenshot current Square/Weebly homepage, product pages, policy pages, and navigation.
- Export Square product list and order/reporting settings if available.
- Record current DNS records, TTLs, proxy state, and Cloudflare page rules.
- Record current Square Online domain settings.
- Confirm where emails, receipts, tax, shipping, and fulfillment notifications currently come from.
- Identify current sales channels that must remain live during cutover.

Claude verification:

- Independently verify current DNS and public HTTP headers.
- Confirm no code or DNS changes occurred.

Exit criteria:

- Rollback DNS records are documented.
- Current business path remains untouched.

### Phase 1: Source Control and Netlify Hardening

Goal: make Netlify production reproducible from Git before it can own `www`.

Actions:

- Push `feature/uiux-doctrine-commerce-hardening` to GitHub.
- Open PR to `main`.
- Claude reviews PR for commerce gates, product UX, and no checkout behavior regressions.
- Merge only after green checks.
- Link Netlify site `afterhoursagenda` to GitHub repo `omgitsthedm/aha-website`.
- Set production branch to `main`.
- Confirm build command and publish settings.
- Set production and deploy-preview env vars in Netlify.
- Try again to enable non-Git production deploy block.

Claude verification:

- Verify Netlify project id, name, admin URL, repo, branch, build settings, and env var names.
- Verify no secret values are exposed in logs.

Exit criteria:

- A Git-backed preview deploy works from PR.
- A Git-backed production deploy can be created from `main`.
- Manual wrong-site deploy path is blocked or explicitly documented as still open.

### Phase 2: API and Sandbox Commerce Readiness

Goal: prove checkout and fulfillment without touching live orders.

Actions:

- Add environment switching for Square base URL:
  - production: `https://connect.squareup.com`
  - sandbox: `https://connect.squareupsandbox.com`
- Add a sandbox deploy context with sandbox-only Square values.
- Create a sandbox Square catalog item matching one AHA product.
- Create a sandbox Square location.
- Create a Printful test mode or manual non-production fulfillment path if available.
- Build a webhook receiver for Square paid events.
- Build a fulfillment adapter that can run in dry-run mode.
- Build an idempotency table or durable event log before any automatic fulfillment.

Claude verification:

- Read-only code review for webhook signature verification, idempotency, retries, and no live tokens in repo.
- Run sandbox-only checkout after explicit safe-path approval.

Exit criteria:

- Sandbox payment link creates a sandbox paid order.
- Webhook is received and verified.
- Fulfillment dry-run produces the exact Printful order payload without confirming a real fulfillment.
- No live order, customer, payment, or fulfillment record is created.

### Phase 3: Production Readiness Without DNS Cutover

Goal: make the Netlify URL production-capable while `www` still points to Square/Weebly.

Actions:

- Deploy Git-backed production to `afterhoursagenda.netlify.app`.
- Verify homepage, shop, PDP, cart, policy pages, sitemap, robots, metadata, and structured data.
- Verify production environment variable names are present.
- Run read-only catalog page render checks.
- Do not click live checkout yet.
- Prepare a David-run live checkout safe path:
  - low-risk test product or private test product
  - explicit refund plan
  - explicit order cancellation plan
  - explicit Printful fulfillment prevention plan
  - exact approval phrase before the test

Claude verification:

- Independent browser QA on Netlify URL.
- Independent source review of checkout and fulfillment readiness.
- Confirm production Netlify URL is not mixed with Square/Weebly assets unintentionally.

Exit criteria:

- Netlify URL can function as production storefront.
- Production checkout safe path is written and approved or deliberately deferred.

### Phase 4: Domain Staging and Rollback Setup

Goal: prepare DNS so the final switch is reversible.

Actions:

- In Netlify, add `www.afterhoursagenda.com` to the target project first.
- Decide primary domain:
  - recommended: `www.afterhoursagenda.com` primary
  - apex redirects to `www`
- Add apex handling in Netlify or Cloudflare according to Netlify guidance.
- Lower DNS TTL 24-48 hours before cutover if Cloudflare allows it.
- Create an emergency fallback hostname for the current Square/Weebly store if possible:
  - `old.afterhoursagenda.com`
  - `square.afterhoursagenda.com`
  - or a documented Square-provided fallback URL
- Prepare exact rollback record values.

Claude verification:

- Verify Netlify domain settings before DNS change.
- Verify certificate status when DNS points to Netlify.
- Verify fallback hostname works before changing `www`.

Exit criteria:

- Netlify recognizes the custom domain.
- SSL can be issued after DNS points correctly.
- Rollback path is documented and tested.

### Phase 5: Switch Window

Goal: flip with minimal business risk.

Recommended timing:

- Low traffic window.
- No product drop, paid ad push, email send, or social campaign within the cutover window.
- David, Codex, and Claude available.

Actions:

- Put code freeze in effect.
- Confirm no active Netlify deploy in progress.
- Confirm Square/Weebly fallback reachable.
- Change `www` DNS from current Square/Weebly path to Netlify target.
- Change apex behavior according to chosen approach.
- Wait for DNS and SSL propagation.
- Verify:
  - `https://www.afterhoursagenda.com`
  - `https://afterhoursagenda.com`
  - `/shop`
  - a representative `/product/...`
  - `/cart`
  - `/shipping`
  - `/returns`
  - `/privacy`
  - `/terms`
  - `/accessibility`
  - `/sitemap.xml`
  - `/robots.txt`
- Do not run checkout unless the live safe path has separate approval.

Claude verification:

- Independent external browser verification.
- Confirm no Square/Weebly headers remain on `www`.
- Confirm no Pole Position strings or wrong-site HTML.

Exit criteria:

- Custom domain serves the Netlify AHA storefront.
- SSL valid.
- No major route regressions.
- Rollback not needed after monitoring window.

### Phase 6: Post-Cutover Monitoring

Goal: catch failures before customers do.

Actions:

- Monitor Netlify deploy logs and function logs.
- Monitor Square orders.
- Monitor Printful order/fulfillment status.
- Monitor support inbox.
- Monitor 404s and broken links.
- Monitor Search Console if configured.
- Submit sitemap after DNS stabilizes.
- Keep Square/Weebly fallback for at least 7 days.

Claude verification:

- Next-day read-only site audit.
- Verify sitemap and key route indexability.
- Verify no live commerce mutation occurred outside approved path.

Exit criteria:

- No domain, checkout, fulfillment, or major UX blockers after 24-48 hours.

## Go/No-Go Checklist

No-Go if any item is false:

- Netlify site is Git-linked to the correct repo and branch.
- Netlify production env vars are configured by name.
- `npm run lint` passes.
- `npm run build` passes.
- `npm run verify:netlify-site` passes.
- Git-backed deploy preview passes route smoke.
- Git-backed production deploy passes `npm run verify:netlify-live`.
- Custom domain is attached to the correct Netlify site before DNS switch.
- DNS rollback records are documented.
- Square checkout safe path is either sandbox-verified or deliberately deferred.
- Printful fulfillment path is either automated and verified, or manual fallback is explicit.
- Claude signs off independently.
- David gives scoped approval for DNS cutover.

## What Other Fashion Labels Commonly Have That AHA Does Not Yet Have

Priority is based on business impact and cutover risk.

### Highest value before or immediately after cutover

- Search across products and collections.
- Better filters: product type, color, size availability, price, drop, collection.
- Product recommendations: related pieces, recently viewed, complete the look.
- Wishlist or saved pieces.
- Back-in-stock and drop alerts by product or size.
- Stronger size confidence:
  - garment-specific size charts
  - fit notes
  - model measurements
  - measurements shown near size selector
  - size chart as image in gallery
- Reviews or UGC proof, even if initially curated from social.
- Better product imagery:
  - full zoom
  - lifestyle shots
  - detail shots
  - print close-ups
  - on-body shots
- Order tracking page.
- Clear returns portal or returns request flow.
- Abandoned-cart email/SMS flow if consent and tracking are set up.

### Brand-building improvements

- Lookbook/editorial pages for drops.
- Drop calendar.
- Collection landing pages that feel like campaigns, not just filtered grids.
- Style gallery from Instagram/TikTok.
- Creator/artist notes for designs.
- Materials and print-quality explainer.
- Made-to-order sustainability explainer without overclaiming.
- Press or social proof page.

### Operational and marketing improvements

- Google Merchant Center feed.
- Meta/TikTok catalog feed.
- Product schema and richer JSON-LD per variant.
- Klaviyo or similar email capture and post-purchase flows.
- Customer account or magic-link order lookup.
- Self-service order status.
- Analytics/event tracking plan with consent handling.
- Better 404 and out-of-stock recovery paths.
- Accessibility audit and fixes.
- Core Web Vitals and image performance pass.

## Suggested Build Backlog

### Sprint A: Safe Launch Plumbing

- Git-link Netlify.
- Add Netlify env vars.
- Add sandbox env switching.
- Add webhook foundation.
- Add route smoke scripts.
- Add custom domain readiness checklist.

### Sprint B: Fulfillment Confidence

- Map Square catalog IDs to Printful variants.
- Add Printful dry-run payload generation.
- Add Square paid-order webhook.
- Add fulfillment event log.
- Add manual review mode before auto-confirming Printful orders.
- Add Printful shipment webhook.

### Sprint C: Shopper Confidence

- Improve size guide per product type.
- Add fit notes and model measurement fields.
- Add product image zoom/lightbox.
- Add shipping/returns accordion on PDP.
- Add order tracking/support page.

### Sprint D: Fashion Label Polish

- Add search.
- Add wishlist.
- Add back-in-stock/drop alerts.
- Add lookbook/editorial drop pages.
- Add recommendations and recently viewed.
- Add UGC/social proof module.

### Sprint E: Growth and Measurement

- Add Merchant Center feed.
- Add Meta/TikTok product feed.
- Add consent-aware analytics.
- Add abandoned cart and post-purchase email flows.
- Add Search Console and sitemap monitoring.

## Claude Code Verification Lane

Claude should not duplicate Codex implementation work. Claude's role should be adversarial verification:

1. Verify current facts:
   - DNS
   - Netlify site id
   - Git link
   - env var names
   - build settings
2. Review code for:
   - secret leakage
   - checkout mutation risk
   - webhook idempotency
   - fulfillment duplication risk
   - route regressions
3. Run independent checks:
   - `npm run lint`
   - `npm run build`
   - `npm run verify:netlify-site`
   - browser smoke on preview/Netlify URL
4. Sign off or block:
   - if blocked, provide file/line evidence and exact failing gate
   - if signed off, state what was not tested, especially live checkout and fulfillment

## David Approval Gates

These require explicit scoped approval:

- Linking Netlify to GitHub if it changes deployment behavior.
- Setting or rotating secrets.
- Adding or changing DNS records.
- Running any live checkout.
- Creating or canceling live Square orders.
- Creating, confirming, canceling, or modifying Printful fulfillment.
- Publishing production deploys.
- Adding analytics/pixels or marketing trackers.

Use `APPROVE LIVE CHANGE` with the exact action named when the work crosses one of those lines.
