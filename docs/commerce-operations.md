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
4. Paid orders enter the Apliiq queue. The configured cancellation hold remains 60 minutes. Quarter-hour fulfillment reconciliation processes eligible orders and refreshes supplier/tracking status.
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
- Paid orders without a confirmation/fulfillment record and uncertain payments are flagged after 15 minutes. Missing or unsent shipping notifications are checked separately, including outbox rows needing attention before a provider message ID exists. Missing delivery evidence is flagged after 30 minutes for receipts sent since monitoring began. Bounce/failure/suppression/complaint events are flagged when received.
- Supplier acceptance is overdue after the cancellation hold plus 90 minutes. Normal hold time is not an error. Receipt, fulfillment and Square recovery workers become stale after 45 minutes; Square events unprocessed for two hours also alert.
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

## Recovery and backups

Prefer a reviewed forward fix. Netlify Database migrations run with deployment and are additive; publishing an old artifact can be incompatible with the current schema. Revert the affected application change in source, preserve applied migrations, run the same checks, and deploy the repaired commit to the exact site. Do not republish an older database-coupled deploy or run hosted migrations manually.

A database restore is a separate destructive operation. Preserve post-backup payments, orders and provider IDs before choosing a recovery point; restoring application rows must never cause another payment or supplier POST. Do not restore over production as a diagnostic step.

The November 7 isolated drill restored 30 application tables and 218 rows from a consistent read-only snapshot, matched every table's content hash, and applied the additive reliability migration. Private evidence and backup reside outside Git in the shop audit's `commerce-private/restore-drill` folder with restricted permissions. Source PostgreSQL 17 schema was restored on local PostgreSQL 16 after removing only its unsupported `transaction_timeout` setting. This verifies application row recovery, not managed platform metadata, exact sequence positions, or a full point-in-time production restore. Identity counters must be reconciled before any restored database accepts new writes; retain the original database until the recovery is accepted.

## Recovery controls and financial state

- Every completed checkout creates its recovery obligation in the same database transaction. Purchased title, approved supplier SKU, quantity and price are frozen with the quote and used during fulfillment revalidation.
- Verified Square webhooks commit inbox entries before provider calls. The separate Square recovery job polls updated payments with overlap and pagination, rotates existing purchases for refund/fee verification, and sweeps disputes, including resolved states. All reads have bounded timeouts; retries never create payments or refunds.
- The owner order screen supports audited reconciliation, verified-address receipt correction/resend (three per order per day), and release of a safe pre-submission hold. It refuses an uncertain or previously attempted supplier submission. An unresolved in-flight receipt must be checked before a resend; superseded pending receipts no longer retry to the old address.
- Support messages and their owner notification commit together. `/admin/orders/` retains open/waiting cases even when mail is down, with audited resolution.
- Refund amount, pending/failed refunds, cancellations, dispute deadlines and processing fees are separate from checkout completion. Any affected production requires owner review; a Square refund does not cancel an Apliiq order. Do not automatically refund, accept a dispute or promise a replacement.
- Partial shipments remain partial. Tracking requires positive shipped quantities for purchased SKUs. A label or supplier ID cannot hide a hold or imply completed shipping. Review requests require complete shipping and no refund, dispute or active error.
- Supplier expected dates take precedence; otherwise use the approved seven-business-day production calendar. Supplier garment/artwork/supplies flags remain visible operational data. These estimates do not prove physical printing started.
- Weekly accounting labels gross receipts, merchandise, shipping, collected tax, refunds, processing fees and net receipts separately. Unknown fees remain unknown, and supplier costs/bank payouts are not inferred.

## Independent alerts, privacy and retention

- `AHA_HEALTHCHECK_COMMERCE_URL` is a secret function variable for one Healthchecks.io check. The commerce monitor sends aggregate success/failure only. A 15-minute period plus 15-minute grace detects a stopped platform independently of Netlify/GitHub. Email alerts go to the AHA support inbox. A deliberate failure and recovery were tested before deployment; require a real scheduled heartbeat after release to establish activation.
- The receipt monitor follows the newest verified resend while retaining older delivery evidence. A queued resend is not delivery proof; its outbox and delivery callback must succeed.
- `AHA_ORDER_LINK_SECRET` signs new order links. Existing Square-derived order and unsubscribe links remain accepted. For subsequent dedicated-key rotation, retain the old secret in the bounded `AHA_ORDER_LINK_PREVIOUS_SECRETS` JSON list until existing links are intentionally retired; never print these values or commit them.
- PostHog error capture respects analytics consent and Global Privacy Control. Only a fixed error category, first-party asset path and line number are sent; raw messages, exception stacks, rejected values, addresses, email and signed-link query strings are excluded. Capture is capped at three events per page.
- Payment attempts have an atomic per-client hashed-IP limit; expired counters are discarded after one day. Support rate/challenge limits and signed/private route protections remain enabled.
- Retention review: paid order, supplier, financial and delivery evidence is retained for support/reconciliation; this release does not invent an irreversible deletion policy. Exported customer backups are private, excluded from Git, and limited to recovery use. Use account deletion for account data, preserve legally required transaction evidence, and agree the accounting retention schedule before any broad purge. Never collect card data, source tokens or credentials in logs.

## Customer status and end-to-end proof

Customers receive the signed `/order/?o=…&k=…` link immediately at checkout and in their receipt, and can attach that order to their authenticated account. Expose only the matching order's customer-facing items, status, shipment links. Keep payment success, supplier acceptance, physical production and shipping distinct.

A complete genuine-order check follows: one payment, one durable order, receipt accepted by the recipient server, one supplier order after the hold, truthful customer status, then tracking and shipping notification when the supplier ships. The customer performs the next real purchase; routine release verification does not create paid orders or synthetic production emails.

No test proves a card issuer will approve every future purchase or that every email reaches an Inbox. The safeguards make missing records, unconfirmed delivery and stalled recovery visible, and provide safe recovery without duplicate charges or supplier orders.

## Crawler and automated-agent policy

- Conventional search indexing, user-initiated AI retrieval/search, link previews, accessibility tools, and advertising landing-page crawlers may fetch the same public storefront routes available to ordinary visitors.
- Checkout, operations, order-confirmation, and API surfaces remain excluded or carry route-level `noindex` according to their response semantics.
- Model-training/corpus agents and named bulk SEO harvesters are denied by the active storefront robots policy; the non-canonical Netlify host is denied to every crawler.
- the published `llms.txt` is informational only and does not override `robots.txt`.
- Little Fight NYC owns the technical policy. Review it at least annually and whenever the business adopts a search, advertising, AI, or SEO vendor whose crawler requires an exception.

Crawler directives are cooperative controls, not access control. Sensitive routes must remain protected by application authentication, authorization, and response behavior.


## Customer lifecycle and private requests

Supplier observations enqueue transactional updates only from explicit Apliiq statuses: received/preparing, in production, ready to ship, or delayed/held. A row-locked monotonic rank prevents backwards updates; each milestone and its outbox message commit together and dedupe per order. Refunds, cancellation and open disputes suppress these updates. Shipment emails name the purchased quantities in each parcel and any remaining pieces.

The signed private order page accepts address, cancellation, exchange, refund, missing-parcel, receipt-email and general requests. Requests are durable support cases, notify the owner and remain requests until reviewed. A cancellation/address request holds a queued order; the submission claim also checks unresolved requests. An already submitted supplier order cannot be withdrawn automatically. Resolve the case and verify the provider outcome before releasing a hold. Never issue automatic refunds or replacements.

Carrier automation requires `AHA_TRACKING_ENABLED=true` and a production Functions secret `AHA_EASYPOST_API_KEY`. EasyPost standalone tracking is paid; do not enable it without an authorized account and spending scope. `AHA_TRACKING_MONTHLY_LIMIT` defaults to 100 registrations and uses an atomic monthly ceiling. The scheduled tracker runs every 15 minutes, processes four due parcels per invocation and polls registered parcels hourly. API outages retain retryable work and surface in commerce health. No historical parcel lacking item quantities is silently assumed delivered.

Delivery requires a matching production-mode tracker, credible timestamps, a delivered scan and coverage of every purchased SKU quantity across parcels. When delivery tracking is active and the order has parcel-item evidence, review invitations wait ten days after confirmed delivery. While tracking is disabled, or for historical orders without parcel-item evidence, preserve the approved ten-day-after-shipping-email schedule. That fallback is a review schedule, never proof of delivery. Carrier acceptance, label creation, shipping emails and elapsed time are never delivery proof. Existing voluntary reviews remain available from shipped private orders; moderation remains required.

### Remaining external verification

Apliiq's documented inventory view is a delayed supplier snapshot, not guaranteed reservation or a public stock API. Its on-demand satin label remains independent of the prepaid inventory count. Maintain supplier stock checks and treat awaiting-garment/artwork/supplies flags as operational evidence, without silently changing the garment or artwork.

Real iPhone Apple Pay, Android Google Pay, an Outlook destination, delivered garment quality require their actual device/account/physical evidence. Chrome viewport and mocked-wallet checks do not certify them. The dated shop audit holds the current results and exact remaining actions.

Owner reaffirmed the checkout tax policy on November 7: charge 8.1% only for Arizona shipping addresses, with no tax on other states or countries. The storefront passes that tax rule into Square calculation; it does not infer Arizona from an inconsistent ZIP code. This records the owner-approved commerce rule, not a claim about tax registration.
