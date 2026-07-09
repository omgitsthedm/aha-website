# AHA Netlify Commerce Backend Readiness

Date: 2026-07-08
Status: Local code readiness only. No push, deploy, DNS change, secret change, checkout test, order mutation, or fulfillment mutation has been performed.

## What Changed

The backend now has the minimum safe surfaces needed before a custom-domain cutover rehearsal:

- Square API client can target production or sandbox based on `SQUARE_ENVIRONMENT`.
- Checkout redirect URL resolves from a validated configured site URL or request origin; client-supplied redirects remain ignored.
- Cart checkout allows Square sandbox checkout hosts for deploy-preview testing.
- Printful client now fails before sending requests when `PRINTFUL_API_TOKEN` is missing.
- Square webhook receiver exists at `/api/webhooks/square`.
- Printful webhook receiver exists at `/api/webhooks/printful`.
- Commerce readiness endpoint exists at `/api/commerce/readiness`; it requires `AHA_READINESS_TOKEN` outside local dev.
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

Fulfillment remains held for manual review or dry-run handling until a separate approval adds durable order storage, idempotency, and Printful order creation.

## Production Env Names Still Needed In Netlify

Set these in Netlify for site `afterhoursagenda` / `275b4115-16bf-42fb-9b36-6bce9bb93608`. Do not paste values into chat or Git.

Square:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_APPLICATION_ID`
- `SQUARE_LOCATION_ID`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`

Printful:

- `PRINTFUL_API_TOKEN`
- `PRINTFUL_STORE_ID`
- `PRINTFUL_WEBHOOK_SECRET_KEY`
- `PRINTFUL_WEBHOOK_PUBLIC_KEY`

Public/internal runtime:

- `NEXT_PUBLIC_SQUARE_APP_ID`
- `AHA_READINESS_TOKEN`

Committed non-secret defaults now cover:

- `NEXT_PUBLIC_SITE_URL=https://www.afterhoursagenda.com`
- `SQUARE_API_VERSION=2024-01-18`
- `SQUARE_ENVIRONMENT=production` for production
- `SQUARE_WEBHOOK_NOTIFICATION_URL=https://www.afterhoursagenda.com/api/webhooks/square` for production
- `AHA_FULFILLMENT_MODE=manual` for production
- `SQUARE_ENVIRONMENT=sandbox` for deploy previews and branch deploys
- `AHA_FULFILLMENT_MODE=dry-run` for deploy previews and branch deploys

## Webhook Setup Targets

Square production subscription URL:

```text
https://www.afterhoursagenda.com/api/webhooks/square
```

Square signature validation uses:

- header: `x-square-hmacsha256-signature`
- signature key: `SQUARE_WEBHOOK_SIGNATURE_KEY`
- exact notification URL: `SQUARE_WEBHOOK_NOTIFICATION_URL`
- raw request body

Square also sends `square-environment`; the route rejects events that do not match the configured `SQUARE_ENVIRONMENT`.

Printful production webhook URL:

```text
https://www.afterhoursagenda.com/api/webhooks/printful
```

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

Expected current result before keys are set:

```text
Missing 10 required readiness vars.
```

Build and type-check:

```bash
npm run lint
npm run build
```

## Remaining Cutover Blockers

- Netlify project still must be Git-linked to `omgitsthedm/aha-website` and production branch `main`.
- Netlify non-Git production deploy blocking still needs UI/API confirmation.
- Required Netlify env names listed above must be added.
- Square production and sandbox webhook subscriptions must be created.
- Printful production webhook configuration must be created.
- Sandbox checkout must be tested only through a scoped safe path.
- Printful order creation remains intentionally unimplemented until durable storage/idempotency and manual review mode are built.
- DNS must not change until the custom domain is attached to the correct Netlify site and rollback values are documented.

