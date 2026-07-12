# AHA Production Commerce Operations

## Access

- Dashboard: `https://afterhoursagenda.com/ops`
- Password is stored in the macOS Keychain under service `After Hours Agenda Production Ops`, account `davidmarsh`.
- Terminal retrieval: `security find-generic-password -s 'After Hours Agenda Production Ops' -a davidmarsh -w`
- Never paste the password into Git, chat, issues, screenshots, or documentation.

## Production flow

1. Square calculates the tax-inclusive quote and processes the payment.
2. AHA writes the order and payment to Netlify Database.
3. AHA creates one Printful draft per owning store.
4. Production confirmation requires all three gates: `AHA_FULFILLMENT_MODE=auto`, `PRINTFUL_ALLOW_CONFIRM_ORDERS=true`, and `PRINTFUL_LIVE_MODE=true`.
5. Signed provider webhooks reconcile payment, fulfillment, and shipment state.
6. The scheduled `reconcile-orders` function retries eligible paid orders every 15 minutes.

## Customer status

Customers use `/track-order` with the AHA order number and checkout email. The response contains only the matching order's customer-facing status, items, total, and shipment links.

## Current confirmation policy

Production is automatic: only a verified completed Square payment can create a Printful order. The remote Printful order id is persisted before confirmation, so confirmation retries reuse the same order instead of creating duplicates. Preview and branch deploys remain dry-run with both confirmation flags off.

## Provider tests

The operations dashboard exposes signed webhook tests. These do not create a payment or Printful order. Square's control uses the provider test-notification API. Printful's control sends a correctly signed synthetic v2 event through the deployed endpoint and database dedupe path.

## Known external dependency

Branded order, production, exception, and tracking email uses Resend through a durable database outbox. Required production variables: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`, and `ORDER_SUPPORT_EMAIL`. Pending email is retried every five minutes and by the reconciliation job. Square receipts remain independent.

After verifying the Resend domain and setting the production API key, sign in at `/ops` and use **Test order email**. It sends one branded system message to `ORDER_SUPPORT_EMAIL` without creating an order or charging a card.
