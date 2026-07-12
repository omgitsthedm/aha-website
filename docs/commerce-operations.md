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
4. Printful confirmation remains disabled unless all three production gates are enabled.
5. Signed provider webhooks reconcile payment, fulfillment, and shipment state.
6. The scheduled `reconcile-orders` function retries eligible paid orders every 15 minutes.

## Customer status

Customers use `/track-order` with the AHA order number and checkout email. The response contains only the matching order's customer-facing status, items, total, and shipment links.

## Current confirmation policy

Production is intentionally `manual`: Printful drafts are created after payment, but fulfillment is not confirmed automatically. Enable automatic confirmation only after one controlled live purchase proves Square payment, DB persistence, Printful draft cost/items/address, and webhook reconciliation.

## Provider tests

The operations dashboard exposes signed webhook tests. These do not create a payment or Printful order. Square's control uses the provider test-notification API. Printful's control sends a correctly signed synthetic v2 event through the deployed endpoint and database dedupe path.

## Known external dependency

AHA-owned transactional email is not configured. Square can send its receipt, but branded order, production, and tracking email needs an email provider/domain credential before it can be implemented honestly.
