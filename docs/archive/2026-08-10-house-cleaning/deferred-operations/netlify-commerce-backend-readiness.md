# AHA Netlify Commerce Backend Readiness

Last verified: 2026-07-08 21:57 MST by Codex.
Status: Live on Netlify custom domain with commerce env names present. No live checkout, Square order creation, Printful fulfillment, or fulfillment automation has been verified.

## Current Backend Surface

- Square API client targets production or sandbox based on `SQUARE_ENVIRONMENT`.
- Checkout redirect URL resolves from the configured site URL or request origin; client-supplied redirects remain ignored.
- Cart checkout allows Square sandbox checkout hosts for deploy-preview testing.
- Printful client fails before sending requests when `PRINTFUL_API_TOKEN` is missing.
- Square webhook receiver: `/api/webhooks/square`.
- Printful webhook receiver: `/api/webhooks/printful`.
- Commerce readiness endpoint: `/api/commerce/readiness`; requires `AHA_READINESS_TOKEN` outside local dev.
- `npm run verify:commerce-readiness:netlify` checks required Netlify env var names without printing secret values.
- Netlify production defaults remain production/manual.
- Netlify deploy previews and branch deploys default to sandbox/dry-run.

## Current Safety Boundary

The webhook routes verify signatures and acknowledge/log events only.

They do not:

- create Square orders
- update Square orders
- create Printful orders
- confirm Printful orders
- cancel Printful orders
- send customer email
- mutate product, inventory, customer, order, fulfillment, shipping, tax, discount, or analytics data

Fulfillment remains manual until a separate approved implementation adds durable order storage, idempotency, Printful draft order creation, review/approval controls, retry handling, and customer-facing order status.

## Production Env Name Readiness

`npm run verify:commerce-readiness:netlify` passes for production context.

Required names present:

Square:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_APPLICATION_ID`
- `SQUARE_ENVIRONMENT`
- `SQUARE_API_VERSION`
- `SQUARE_LOCATION_ID`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`
- `SQUARE_WEBHOOK_NOTIFICATION_URL`

Printful:

- `PRINTFUL_API_TOKEN`
- `PRINTFUL_STORE_ID`
- `PRINTFUL_WEBHOOK_SECRET_KEY`
- `PRINTFUL_WEBHOOK_PUBLIC_KEY`

Public/internal runtime:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SQUARE_APP_ID`
- `AHA_FULFILLMENT_MODE`
- `AHA_READINESS_TOKEN`

Known non-secret production values observed:

- `NEXT_PUBLIC_SITE_URL=https://afterhoursagenda.com`
- `SQUARE_ENVIRONMENT=production`
- `AHA_FULFILLMENT_MODE=manual`
- `SQUARE_WEBHOOK_NOTIFICATION_URL=https://www.afterhoursagenda.com/api/webhooks/square`

## Webhook Configuration

### Square

Handoff reports Square production webhook:

- Name: `AHA Netlify Square Webhook`
- URL reported by handoff: `https://afterhoursagenda.netlify.app/api/webhooks/square`
- Events:
  - `order.created`
  - `order.fulfillment.updated`
  - `order.updated`
  - `payment.created`
  - `payment.updated`

Current Netlify production env reports:

```text
SQUARE_WEBHOOK_NOTIFICATION_URL=https://www.afterhoursagenda.com/api/webhooks/square
```

Important: Square signature verification uses the exact notification URL. If Square is posting to `.netlify.app` while the app verifies against `www.afterhoursagenda.com`, signature checks will fail. Confirm Square's configured URL and align one side before relying on Square webhook processing.

Square signature validation uses:

- header: `x-square-hmacsha256-signature`
- signature key: `SQUARE_WEBHOOK_SIGNATURE_KEY`
- exact notification URL: `SQUARE_WEBHOOK_NOTIFICATION_URL`
- raw request body

### Printful

Handoff reports Printful v2 webhook:

- URL: `https://afterhoursagenda.netlify.app/api/webhooks/printful`
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

Printful signature validation uses:

- header: `x-pf-webhook-signature`
- optional public-key header: `x-pf-webhook-public-key`
- secret key: `PRINTFUL_WEBHOOK_SECRET_KEY`
- raw request body

## Commands

Check target Netlify identity:

```bash
npm run verify:netlify-site
```

Check production env names without printing values:

```bash
npm run verify:commerce-readiness:netlify
```

Check Netlify default URL:

```bash
npm run verify:netlify-live
```

Check custom apex URL:

```bash
LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live
```

Build and type-check:

```bash
npm run lint
npm run build
```

## Remaining Backend Work

- Confirm and align Square webhook URL versus `SQUARE_WEBHOOK_NOTIFICATION_URL`.
- Add durable order/event storage before any fulfillment automation.
- Add idempotency keyed by Square event ID/order/payment IDs.
- Map Square variation/catalog IDs to Printful variant/external IDs.
- Add Printful draft order creation in dry-run/manual-review mode.
- Add manual review screen or operator workflow before confirming Printful fulfillment.
- Add shipment tracking persistence and customer-facing order status.
- Create a David-approved sandbox checkout test plan.
- Create a David-approved live checkout safe path before any live transaction.
