# AHA production commerce operations

## Ownership and escalation

- **Technical release and incident owner:** Little Fight NYC, represented in GitHub by `@omgitsthedm`.
- **Customer-support route:** `info@afterhoursagenda.com`.
- **Security-report route:** `info@afterhoursagenda.com`, published at `/.well-known/security.txt`.
- **Provider authority:** Square, APLIIQ, legacy Printful, Netlify Database, Resend, Domain Name System (DNS), and analytics changes require an explicitly scoped production task. Routine code verification never creates provider events.

Treat an unavailable storefront, broken checkout, duplicate charge or order, customer-data exposure, fulfillment misrouting, or loss of order reconciliation as an incident. Stop rollout work, preserve logs and identifiers without copying protected data, and notify the technical owner. Customer communication goes through the support route; do not contact customers from an engineering test.

## Access and source

- Live administration: `https://afterhoursagenda.com/admin/`.
- Active application: `site-preview/` (Astro and Netlify Functions). Root Next.js commerce code is historical and must not be used to configure the live store.
- Source identity and exact Netlify site are in `site-preview/client.config.json`; verify against the fleet manifest before release.
- Use scoped credentials through private environment/secret stores. Never print credentials or include customer details in GitHub, monitoring output, or public reports.
- Printful is inactive. Do not reactivate it or enable historical provider flags as part of checkout recovery.

## Production flow

1. Square calculates the quote; the server checks the active product/variation allow list and order totals before payment.
2. A durable checkout claim and stable payment idempotency key prevent simultaneous card/wallet submissions from creating separate charges. An uncertain outcome is reconciled with Square before any new charge is attempted.
3. A completed Square payment queues its confirmation independently of fulfillment enablement. The durable notification outbox and Resend idempotency key prevent duplicate receipts. New mail dispatches immediately after the payment/webhook response; deferred mail and missing confirmations are recovered every 15 minutes.
4. Paid orders enter the Apliiq queue. The configured cancellation hold remains 60 minutes. Hourly fulfillment reconciliation processes eligible orders and refreshes supplier/tracking status.
5. Apliiq submission claims and uncertain outcomes are retained. A timeout or missing supplier order ID requires reconciliation, never a blind second create request.
6. Signed Square and Apliiq callbacks update payment, fulfillment and shipping. Apliiq acceptance means **With the maker**, not confirmed physical printing.
7. Signed Resend callbacks at `/api/webhooks/resend` record only event ID, message ID, event type and timestamps. Delivery, delay, bounce, suppression and complaint are distinct from API send acceptance. Delivered means the recipient mail server accepted the message, not that a person saw it in their Inbox.

## Required operational configuration

- Checkout: `AHA_CHECKOUT_ENABLED`, `AHA_SQUARE_ACCESS_TOKEN`, `AHA_SQUARE_APPLICATION_ID`, `AHA_SQUARE_LOCATION_ID`, `AHA_SQUARE_MERCHANT_ID`, `AHA_SQUARE_WEBHOOK_SIGNATURE_KEY`.
- Fulfillment: `AHA_FULFILLMENT_ENABLED`, `AHA_FULFILLMENT_START_AT`, `AHA_FULFILLMENT_HOLD_MINUTES`, `AHA_APLIIQ_API_KEY`, `AHA_APLIIQ_SHARED_SECRET`.
- Receipts: `AHA_ORDER_EMAIL_ENABLED`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`, `RESEND_WEBHOOK_SECRET`.
- Monitoring: dedicated read-only `AHA_COMMERCE_MONITOR_TOKEN`, stored in production Netlify Functions and the repository Actions secret. Owner alerts use `AHA_OWNER_EMAIL`, falling back to `RESEND_REPLY_TO`.
- New sales stop when core payment, fulfillment or receipt configuration is disabled/missing. Existing payment reconciliation remains available. Secret presence is not proof that a provider accepts that credential; authenticated provider and catalog checks remain necessary.
- Preview and development commerce stay non-transactional. Production secrets and callbacks belong to the exact approved site only.

## Normal release path

1. Branch from the current verified `main` and use a narrowly named release branch.
2. Open a pull request. The required checks must cover static quality, unit tests, product data, browser commerce paths, preview-safe checkout, dependency and secret scanning, and mobile/desktop Lighthouse lab budgets.
3. Finish local builds, tests and browser checks before requesting a hosted preview. Use at most one release-candidate preview when it adds runtime or human-review value, verify its exact commit, and keep preview/branch commerce non-transactional.
4. Resolve review threads and merge by squash only. The release policy prohibits direct pushes to `main`; the repository ruleset enforces that policy once activated.
5. Wait for the Git-connected production deploy to reach `ready`; confirm the deployed commit matches `main` and the configured Netlify site ID.
6. Run the exact-site guard, live-domain guard, representative route checks, canonical/robots/security checks, and a read-only commerce-readiness check. Do not place a real order.
7. Record the pull request, merge commit, deploy ID, checks, live result, and any residual external proof in the dated closeout report.

The repository ruleset must give the owner a pull-request-only emergency bypass so a solo-owner repository can recover without permitting unaudited direct pushes. Any bypass requires an incident reference in the pull request, the smallest possible diff, stated validation and rollback, and post-release observation. It is not a normal release shortcut.

## Monitoring and incident response

- `commerce-monitor` runs at minutes 7, 22, 37 and 52. It records aggregate health and emails the configured owner when attention is needed. An unchanged continuing incident is emailed at most once every six hours; a changed or recovered-then-recurring incident alerts again.
- The independent **Commerce pipeline monitor** GitHub workflow is scheduled at minutes 11, 26, 41 and 56. It checks the public release identity, checkout page/configuration and authenticated aggregate health endpoint. Failed runs use GitHub Actions notifications; keep owner Actions failure notifications enabled. GitHub schedule delays remain possible.
- The private `/api/commerce/health` endpoint reports counts and problem codes only. It cannot create orders, submit payments, alter fulfillment or send mail. It also detects stale local monitoring, so a broken Netlify scheduled job cannot report itself healthy indefinitely.
- Paid orders without a receipt/fulfillment record and uncertain payments are flagged after 15 minutes. Missing delivery evidence is flagged after 30 minutes for receipts sent since monitoring began. Bounce/failure/suppression/complaint events are flagged when received.
- Supplier acceptance is overdue after the cancellation hold plus 90 minutes. Normal hold time is not an error. Receipt and fulfillment workers become stale after 45 and 105 minutes respectively; Square events unprocessed for two hours also alert.
- `/admin/` shows the most recent commerce check, problem counts, and stale/missing-monitor warnings. The existing daily health check still audits live routes, catalog/Square mappings and provider configuration; it is not replaced by the frequent aggregate check.
- Run `node ops/commerce-readiness.mjs` with the dedicated monitor token in the process environment for a read-only current-production check. This no longer checks historical Printful variables or copies provider secrets out of Netlify.

Response to a failed check:

1. Read the failed check and the matching existing payment/order/notification records. Confirm Square payment outcome before any retry. A declined attempt is not a paid order.
2. If a paid order is missing its confirmation, repair/recover the existing outbox row. Inspect Resend using its stored provider message ID. Never mark a receipt delivered based only on API acceptance or send success.
3. For a bounced/suppressed recipient, verify the checkout address privately with the customer and correct the appropriate record through the supported administration path. Do not repeatedly send to a failing address. A persistent delivery-failure alert stays open until resolved; current monitoring does not automatically invent a replacement address.
4. If the customer still cannot find a delivered receipt, inspect the exact checkout destination, Junk and forwarding/Hide My Email behavior. Recipient-server acceptance does not establish Inbox placement.
5. For a stalled supplier handoff, reconcile the existing Square order and Apliiq request/order ID first. Recover the existing paid order without charging the customer again or blindly creating another supplier order.
6. If configuration was disabled accidentally, restore only the verified current production settings, deploy through the reviewed release path, and reconcile the existing backlog. Never bypass the cancellation hold or reactivate a retired integration.
7. Re-run the read-only check and verify actual provider state. A green test suite is not evidence that a real payment, delivery, or physical production step occurred.

Severity and response targets:

- **SEV-1:** confirmed payment, privacy, security, duplicate-order, or broad checkout failure. Stop the release, preserve evidence, notify the technical owner immediately, and begin containment or rollback.
- **SEV-2:** material storefront or fulfillment degradation with a usable workaround. Notify the technical owner promptly, stop unrelated releases, and prepare a narrow fix or rollback.
- **SEV-3:** isolated presentation, metadata, or non-transactional defect. Record it, prioritize it normally, and keep the live service available.

For every incident, record onset time, affected surface, deploy/commit, observed evidence, containment, customer impact, provider impact, decision owner, rollback or forward-fix choice, validation, and closure time. Never paste credentials, tokens, customer personal data, or full provider payloads into GitHub or the report.

## Rollback runbook

1. Confirm the regression is associated with the current deploy and identify a previously successful, known-good production deploy by deploy ID and source commit.
2. Check whether the release changed database schema, data behavior, provider configuration, environment variables, or webhook contracts. An application rollback does not reverse any of those effects.
3. For a code-only compatible rollback, use the Netlify deploy detail page for the known-good successful deploy and choose **Publish Deploy**. Record the acting operator, incident, old/new deploy IDs, and time.
4. Prevent an automatic Git deploy from immediately overwriting the rollback while the incident is active. Then verify the primary domain, exact Netlify site identity, representative routes, checkout entry without completing payment, and the read-only commerce rails.
5. Restore normal Git-connected publishing only after the repaired `main` commit is validated and ready to roll forward.

Netlify Database restoration is a separate, destructive decision: publishing a previous application deploy does not restore the database. A database restore can discard legitimate orders or other writes made after the backup. Only a Team Owner may authorize it after reconciling affected order/payment/provider records and choosing a recovery point. Prefer a targeted forward repair when customer activity continued after the backup.

The runbook is documented and the atomic application rollback mechanism is available. A real production rollback and database-restore exercise must be recorded separately when performed; this document does not claim that exercise has occurred.

## Customer status and end-to-end proof

Customers use `/track-order/` with the AHA order number and checkout email, or their authenticated account. Expose only the matching order's customer-facing items, status, total and shipment links. Keep payment success, supplier acceptance, physical production and shipping distinct.

A complete genuine-order check follows: one payment, one durable order, receipt accepted by the recipient server, one supplier order after the hold, truthful customer status, then tracking and shipping notification when the supplier ships. The customer performs the next real purchase; routine release verification does not create paid orders or synthetic production emails.

No test proves a card issuer will approve every future purchase or that every email reaches an Inbox. The safeguards make missing records, unconfirmed delivery and stalled recovery visible, and provide safe recovery without duplicate charges or supplier orders.

## Crawler and automated-agent policy

- Conventional search indexing, user-initiated AI retrieval/search, link previews, accessibility tools, and advertising landing-page crawlers may fetch the same public storefront routes available to ordinary visitors.
- Checkout, operations, order-confirmation, and API surfaces remain excluded or carry route-level `noindex` according to their response semantics.
- Model-training/corpus agents and named bulk SEO harvesters are denied by the active storefront robots policy; the non-canonical Netlify host is denied to every crawler.
- the published `llms.txt` is informational only and does not override `robots.txt`.
- Little Fight NYC owns the technical policy. Review it at least annually and whenever the business adopts a search, advertising, AI, or SEO vendor whose crawler requires an exception.

Crawler directives are cooperative controls, not access control. Sensitive routes must remain protected by application authentication, authorization, and response behavior.
