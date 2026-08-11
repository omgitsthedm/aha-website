# After Hours Agenda WWW Cutover And Commerce Readiness Record

Date opened: 2026-07-08
Last verified: 2026-07-08 21:57 MST by Codex
Risk tier: Tier 3 live commerce
Status: Custom-domain cutover completed. Commerce fulfillment automation remains intentionally incomplete.

## Executive Read

The new custom AHA storefront is live on the real custom domain.

Verified:

- `https://afterhoursagenda.com/` serves the Next.js AHA storefront from Netlify.
- `https://www.afterhoursagenda.com/` redirects to `https://afterhoursagenda.com/`.
- `https://afterhoursagenda.netlify.app/` serves the same AHA storefront.
- Netlify project `afterhoursagenda` is Git-linked to `omgitsthedm/aha-website`, production branch `main`.
- Current deployed commit is `13c25e83f696b19c7d9230ec4766900cc5485451`.
- `npm run verify:netlify-site` passes.
- `npm run verify:commerce-readiness:netlify` passes.
- `npm run verify:netlify-live` passes for `.netlify.app`.
- `LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live` passes.

Not verified:

- No live checkout was run.
- No live Square order was created.
- No Printful fulfillment was triggered.
- Webhook event delivery/signature processing has not been proven with a real Square or Printful event.

## Current Repo And Deploy State

- Canonical visible path: `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website/aha-website`
- Resolved Git root: `/Users/davidmarsh/Code/LiFi NYC/Clients/After Hours Agenda/Website/aha-website`
- Remote: `https://github.com/omgitsthedm/aha-website.git`
- Current branch: `main`
- Current deployed commit: `13c25e83f696b19c7d9230ec4766900cc5485451`
- PR #2: `Prepare AHA Netlify commerce backend for cutover`, merged 2026-07-09 04:19:25 UTC.
- GitHub Action `Claude Code Review` failed only because Claude account billing was locked per handoff.

## Current Netlify State

- Target site id: `275b4115-16bf-42fb-9b36-6bce9bb93608`
- Site name: `afterhoursagenda`
- Netlify URL: `https://afterhoursagenda.netlify.app`
- Admin URL: `https://app.netlify.com/projects/afterhoursagenda`
- Primary custom domain: `afterhoursagenda.com`
- Build command: `npm run build`
- Publish output: `.next`
- Build image: `noble`
- Repo provider: GitHub
- Repo path: `omgitsthedm/aha-website`
- Repo branch: `main`
- Latest verified production deploy: `6a4f2851e4c1b9fb71f86a67`
- Latest verified production deploy commit: `13c25e83f696b19c7d9230ec4766900cc5485451`
- `prevent_non_git_prod_deploys`: still reports `false`

## Current DNS And HTTP State

- DNS provider reported by handoff: Wix DNS
- Nameservers:
  - `ns8.wixdns.net`
  - `ns9.wixdns.net`
- Apex A record: `afterhoursagenda.com -> 75.2.60.5`
- `www` CNAME: `www.afterhoursagenda.com -> afterhoursagenda.netlify.app`
- Google Workspace MX records were preserved.
- Public resolver checks against `1.1.1.1`, `8.8.8.8`, and `9.9.9.9` returned Netlify records.
- `https://afterhoursagenda.com/` returns HTTP 200 from `server: Netlify`.
- `https://www.afterhoursagenda.com/` returns Netlify 301 to apex.
- Old Square/Weebly hosting is no longer the DNS target for apex or `www`.

## Commerce Backend Readiness

`npm run verify:commerce-readiness:netlify` passes. Required production env names are present and values were not printed.

Square env names present:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_APPLICATION_ID`
- `SQUARE_ENVIRONMENT`
- `SQUARE_API_VERSION`
- `SQUARE_LOCATION_ID`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`
- `SQUARE_WEBHOOK_NOTIFICATION_URL`

Printful env names present:

- `PRINTFUL_API_TOKEN`
- `PRINTFUL_STORE_ID`
- `PRINTFUL_WEBHOOK_SECRET_KEY`
- `PRINTFUL_WEBHOOK_PUBLIC_KEY`

Netlify/runtime env names present:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SQUARE_APP_ID`
- `AHA_FULFILLMENT_MODE`
- `AHA_READINESS_TOKEN`

Known non-secret production values observed:

- `NEXT_PUBLIC_SITE_URL=https://www.afterhoursagenda.com`
- `SQUARE_ENVIRONMENT=production`
- `AHA_FULFILLMENT_MODE=manual`
- `SQUARE_WEBHOOK_NOTIFICATION_URL=https://www.afterhoursagenda.com/api/webhooks/square`

## Square State From Handoff

- Existing Square Developer app used: `Claude`
- App ID: `sq0idp-g1rzr9cjPnZuw9gJTxD4bA`
- Production location ID: `FGKRPYEXNV482`
- Production webhook name: `AHA Netlify Square Webhook`
- Webhook URL reported by handoff: `https://afterhoursagenda.netlify.app/api/webhooks/square`
- Events selected:
  - `order.created`
  - `order.fulfillment.updated`
  - `order.updated`
  - `payment.created`
  - `payment.updated`

Important follow-up: Netlify production currently reports `SQUARE_WEBHOOK_NOTIFICATION_URL=https://www.afterhoursagenda.com/api/webhooks/square`. Square webhook signature validation requires the exact URL used by Square to match the env var. Confirm and align before relying on Square webhook processing.

## Printful State From Handoff

- Account/store: David / `info@afterhoursagenda.com`
- Store: Square Online / Square store
- Store ID: `14298228`
- Token name: `AHA Netlify Commerce`
- Token scope: single store, Square store `14298228`
- Token permissions: orders read/manage, products read/manage, webhooks read/manage
- Token expiration: Printful max window around July 2028 per handoff
- Printful v2 webhook URL: `https://afterhoursagenda.netlify.app/api/webhooks/printful`
- Events:
  - `order_created`
  - `order_updated`
  - `order_failed`
  - `order_canceled`
  - `shipment_sent`
  - `shipment_returned`
  - `shipment_out_of_stock`
  - `shipment_canceled`
  - `order_put_hold`
  - `order_remove_hold`

## Current Backend Safety Boundary

The webhook routes verify signatures and acknowledge/log events only.

They do not:

- create Square orders
- update Square orders
- create Printful orders
- confirm Printful orders
- cancel Printful orders
- send customer email
- mutate product, inventory, customer, order, fulfillment, shipping, tax, discount, or analytics data

Fulfillment remains held for manual review until a separate approved implementation adds durable order storage, idempotency, Printful draft order creation, review controls, retry handling, and customer-facing order status.

## Commands For Future Work

Verify target Netlify site:

```bash
npm run verify:netlify-site
```

Verify production env names without printing values:

```bash
npm run verify:commerce-readiness:netlify
```

Verify default Netlify URL:

```bash
npm run verify:netlify-live
```

Verify custom apex:

```bash
LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live
```

Build and lint:

```bash
npm run lint
npm run build
```

## Remaining Work Queue

1. Confirm and align Square webhook URL versus `SQUARE_WEBHOOK_NOTIFICATION_URL`.
2. Confirm whether Netlify can enable non-Git production deploy blocking.
3. Run browser QA on live apex across mobile and desktop.
4. Draft a sandbox checkout test path.
5. Draft a live checkout safe path before any live transaction.
6. Add durable event/order storage.
7. Add idempotency for Square webhook events.
8. Map Square catalog/variation IDs to Printful variants.
9. Build Printful draft-order dry-run/manual-review flow.
10. Build shipment tracking and customer-facing order status.

## Approval Preference

David explicitly does not want rigid magic approval phrases going forward. For high-risk live changes, ask for clear scoped plain-language confirmation, restate the exact action, and proceed only after the confirmation is unambiguous.

## Reference Links

- Netlify custom domains: https://docs.netlify.com/manage/domains/get-started-with-domains/
- Netlify external DNS: https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/
- Netlify environment variables: https://docs.netlify.com/build/environment-variables/overview/
- Square webhook overview: https://developer.squareup.com/docs/webhooks/overview
- Square webhook events reference: https://developer.squareup.com/docs/webhooks/v2webhook-events-tech-ref
- Square sandbox overview: https://developer.squareup.com/docs/devtools/sandbox/overview
- Printful API v2 docs: https://developers.printful.com/docs/v2-beta/
