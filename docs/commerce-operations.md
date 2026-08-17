# AHA production commerce operations

## Ownership and escalation

- **Technical release and incident owner:** Little Fight NYC, represented in GitHub by `@omgitsthedm`.
- **Customer-support route:** `info@afterhoursagenda.com`.
- **Security-report route:** `info@afterhoursagenda.com`, published at `/.well-known/security.txt`.
- **Provider authority:** Square, APLIIQ, legacy Printful, Netlify Database, Resend, Domain Name System (DNS), and analytics changes require an explicitly scoped production task. Routine code verification never creates provider events.

Treat an unavailable storefront, broken checkout, duplicate charge or order, customer-data exposure, fulfillment misrouting, or loss of order reconciliation as an incident. Stop rollout work, preserve logs and identifiers without copying protected data, and notify the technical owner. Customer communication goes through the support route; do not contact customers from an engineering test.

## Access

- Dashboard: `https://afterhoursagenda.com/ops`
- Authentication is protected outside the repository. Never retrieve, reveal, copy, or test it during routine work.
- Authenticated dashboard actions require a task that explicitly authorizes the named production effect.

## Production flow

1. Square calculates the tax-inclusive quote and processes the payment.
2. AHA writes the order and payment to Netlify Database.
3. AHA dispatches each immutable order-line snapshot to its recorded fulfillment provider. Historical Printful lines retain their existing store/draft path; approved APLIIQ lines use one durable request identity and one create attempt.
4. Printful confirmation requires `AHA_FULFILLMENT_MODE=auto`, `PRINTFUL_ALLOW_CONFIRM_ORDERS=true`, and `PRINTFUL_LIVE_MODE=true`. APLIIQ creation separately requires production context, Square production, auto mode, `APLIIQ_ALLOW_CREATE_ORDERS=true`, and `APLIIQ_LIVE_MODE=true`.
5. Signed provider webhooks reconcile payment, fulfillment, and shipment state.
6. The scheduled `reconcile-orders` function retries eligible paid orders every 15 minutes.

## Normal release path

1. Branch from the current verified `main` and use a narrowly named release branch.
2. Open a pull request. The required checks must cover static quality, unit tests, product data, browser commerce paths, preview-safe checkout, dependency and secret scanning, and mobile/desktop Lighthouse lab budgets.
3. Verify the Netlify Deploy Preview, including its exact commit. Keep preview and branch commerce non-transactional.
4. Resolve review threads and merge by squash only. The release policy prohibits direct pushes to `main`; the repository ruleset enforces that policy once activated.
5. Wait for the Git-connected production deploy to reach `ready`; confirm the deployed commit matches `main` and the configured Netlify site ID.
6. Run the exact-site guard, live-domain guard, representative route checks, canonical/robots/security checks, and a read-only commerce-readiness check. Do not place a real order.
7. Record the pull request, merge commit, deploy ID, checks, live result, and any residual external proof in the dated closeout report.

The repository ruleset must give the owner a pull-request-only emergency bypass so a solo-owner repository can recover without permitting unaudited direct pushes. Any bypass requires an incident reference in the pull request, the smallest possible diff, stated validation and rollback, and post-release observation. It is not a normal release shortcut.

## Monitoring and incident response

- **Pre-release signals:** required GitHub checks, Netlify preview state and logs, and the preview-safe browser suite.
- **Release signals:** Netlify production deploy state/commit, exact-site guard, live-domain guard, representative route responses, and the production security/SEO endpoints.
- **Commerce signals:** the authenticated operations dashboard, signed provider webhooks, reconciliation status, outbox status, and existing checkout-alert routing. Access these only when the task authorizes the relevant protected production view or effect.
- **Customer signals:** support messages and the first genuine order lifecycle. A simulated payment, order, fulfillment, email, or provider webhook is never release evidence.

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

## Customer status

Customers use `/track-order` with the AHA order number and checkout email. The response contains only the matching order's customer-facing status, items, total, and shipment links.

## Current confirmation policy

Only a verified completed Square payment can enter fulfillment. The remote Printful order id is persisted before confirmation, so confirmation retries reuse the same order instead of creating duplicates. An APLIIQ request id and claim are persisted before its single create call; a `202`, missing order id, timeout, or uncertain response moves to manual review and is never automatically posted twice. Preview and branch deploys remain non-transactional.

APLIIQ is intentionally fail-closed until the new catalog is approved. Required names are `APLIIQ_API_KEY`, `APLIIQ_SHARED_SECRET`, `APLIIQ_API_BASE_URL`, `APLIIQ_DEFAULT_SHIPPING`, and the separate `APLIIQ_PRODUCT_CALLBACK_TOKEN`. Keep both order flags false until APQ mappings, decoration/private-label snapshots, costs, margins, Square variations, and physical samples are approved. The fulfillment callback is `/api/webhooks/apliiq/fulfillment`; product intake/search callbacks are `/api/integrations/apliiq/products/upsert` and `/api/integrations/apliiq/products/search`. Product callbacks only create pending-review records; they never publish a storefront or Square item.

## Provider tests

The operations dashboard exposes the existing signed provider tests and a read-only provider access check. These controls call provider interfaces and can write test or deduplication records, even though they do not create a payment or fulfillment order. Run one only when the current task explicitly authorizes that external test. There is no synthetic APLIIQ order test: APLIIQ has no sandbox, so a real paid pilot and same-day cancellation require separate authorization.

## Known external dependency

Branded order, production, exception, and tracking email uses Resend through a durable database outbox. Required production variables: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`, and `ORDER_SUPPORT_EMAIL`. Pending email is retried every five minutes and by the reconciliation job. Square receipts remain independent.

The **Test order email** control sends a real system message to the configured support address. Do not use it during routine verification or without explicit authorization to send that message.

## Crawler and automated-agent policy

- Conventional search indexing, user-initiated AI retrieval/search, link previews, accessibility tools, and advertising landing-page crawlers may fetch the same public storefront routes available to ordinary visitors.
- Checkout, operations, order-confirmation, and API surfaces remain excluded or carry route-level `noindex` according to their response semantics.
- Model-training/corpus agents and named bulk SEO harvesters are denied by `app/robots.ts`; the non-canonical Netlify host is denied to every crawler.
- `public/llms.txt` is informational only and does not override `robots.txt`.
- Little Fight NYC owns the technical policy. Review it at least annually and whenever the business adopts a search, advertising, AI, or SEO vendor whose crawler requires an exception.

Crawler directives are cooperative controls, not access control. Sensitive routes must remain protected by application authentication, authorization, and response behavior.
