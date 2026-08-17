# After Hours Agenda source of truth

Last verified: August 17, 2026 from local Git, GitHub, the Netlify application programming interface (API), public Hypertext Transfer Protocol Secure (HTTPS) checks, and a read-only Square catalog reconciliation.

This file contains the current routing and operational contract. Detailed design, commerce, legal, and historical evidence remains available on demand under `docs/` and in Git history.

## Canonical source and production map

- **Project**: After Hours Agenda production storefront
- **Canonical local checkout**: `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/aha-website`
- **GitHub repository**: `https://github.com/omgitsthedm/aha-website`
- **Canonical and production branch**: `main`
- **Netlify project**: `afterhoursagenda`
- **Netlify site ID**: `275b4115-16bf-42fb-9b36-6bce9bb93608`
- **Primary domain**: `https://afterhoursagenda.com`
- **Default Netlify domain**: `https://afterhoursagenda.netlify.app`
- **www behavior when operational**: `https://www.afterhoursagenda.com` is configured to return Netlify HTTP 301 to the primary domain
- **Build**: `npm run build`
- **Publish directory**: `.next`
- **Deployment path**: GitHub continuous deployment from `main`
- **Non-Git production deploys**: blocked in current Netlify site metadata

The retired iCloud backup family is not an active source and must remain untouched. A visible compatibility path is valid only when `pwd -P` resolves to the canonical physical checkout above.

## Fresh catalog reset and APLIIQ staging baseline

- **Production deploy ID**: `6a82c62774e9be00087ab0a0`
- **Deployed source commit**: `58c2dd58b540dae0cf579ff32d8d00cff74f5ebe`
- **Artifact state**: `ready`
- **Published**: August 17, 2026 at 08:29:05.951 UTC
- **Netlify production branch**: `main`
- **Release title**: `Fresh catalog reset (#41)`
- **Current availability**: HTTP 200 on the primary, default, branch, and deploy-specific domains
- **Release state**: live deploy and `/release.json` parity verified for the current production release

The primary, branch, and immutable deploy URLs returned the exact production commit from `/release.json`, and the exact-site live guard passed. Dynamic commerce data can change independently, so compare the deploy ID, source commit, representative routes, `/release.json`, and behavior before declaring drift.

- The previous public collection is fully reset. Product-listing routes show the archive notice; retired product detail, product-media, Printful-art, and campaign-asset URLs return `404`; catalog search is empty; saved legacy carts are cleared; and checkout rejects legacy lines before Square pricing or payment.
- Square contains all 120 known After Hours Agenda catalog `ITEM` objects in archived, non-deleted state, with zero active items and zero outstanding archive writes. The final archive used full-object Square upserts and no delete operation; a fresh August 17 dry run reconfirmed the terminal state.
- Gift-card purchase, cart capture, cart restore, quote, and lifecycle-marketing paths fail closed while the catalog is dark. Existing-order tracking, returns, shipping support, payment history, and fulfillment history remain available; no order, payment, customer, or database record was deleted by the reset.
- Public Printful art was removed from the current site. Historical fulfillment requests that still reference the retired host path are rewritten server-side to the immutable Git source at commit `d255aa403b6bf4a978cb5f9af969a72cdc5c2488`, preserving existing-order recovery without republishing old art on the storefront.
- The provider-neutral fulfillment, reconciliation, webhook, and product-intake foundation for APLIIQ is deployed. `APLIIQ_ALLOW_CREATE_ORDERS` and `APLIIQ_LIVE_MODE` both resolve to `false` in production, the committed APLIIQ product map is empty, and the public product callback fails closed while unconfigured.
- No replacement APLIIQ products, new Square merchandise, APLIIQ provider order, payment, customer, fulfillment, shipment, or transactional message was created as part of this staging release.
- Do not activate APLIIQ until production credentials pass readiness checks, callback authentication is proven with APLIIQ, each replacement variant has an approved APQ SKU and immutable decoration/private-label/cost/sample evidence, the corresponding Square object is reviewed, and an explicitly authorized paid pilot and cancellation procedure are ready.

## Runtime ownership

- **Storefront**: Next.js 16.3.0 App Router, React 19.2.8, and TypeScript on Netlify
- **Payments and transaction records**: Square
- **Fulfillment and shipping lifecycle**: the provider-neutral repository dispatcher; APLIIQ is staged but disabled, while Printful records and routing remain available for historical paid orders and rollback safety
- **Operational records**: Netlify Database
- **Transactional email**: the existing Resend outbox and templates
- **Product presentation and provider mappings**: this repository plus verified provider data; no APLIIQ variant is sellable without a committed approved mapping and active Square variation

Never infer price, inventory, product availability, order state, or provider status from an old handoff. Read the current code and authorized provider state for the task.

## Production safety

- Never inspect or commit `.env*` or secret values
- Never fabricate a payment, order, customer, refund, fulfillment, shipment, provider event, email, or production form submission
- Keep Square, APLIIQ, and Printful tokens server-side
- Require verified payment before production fulfillment
- Keep preview, branch, local, and continuous integration contexts non-transactional
- Require all five APLIIQ submission rails: Netlify production context, Square production, automatic fulfillment mode, explicit APLIIQ create-order permission, and APLIIQ live mode
- Never automatically resubmit an APLIIQ request after a timeout, acceptance without a provider order ID, or any other ambiguous outcome; route it to manual review
- Do not register the APLIIQ product callbacks until their URL-token behavior has been proven in a controlled provider test
- Preserve exact-site verification because this property previously experienced a wrong-site deployment
- Require clear scoped authorization for product, commerce, provider, database, Domain Name System (DNS), Netlify, email, analytics, or live-system changes

The first genuine customer order remains an operational observation path unless current protected operations evidence proves it complete. Agents must not manufacture that proof.

## Verification rails

```bash
npm run verify:netlify-site
LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live
npm run verify:commerce-readiness:netlify
```

`verify:commerce-readiness:netlify` checks required variable names without printing protected values. For code changes, add proportional local checks from `npm run lint`, `npm run typecheck`, `npm test`, `npm run validate:all`, and `npm run build`.

Do not use a real checkout as verification. When public live requests encounter Netlify's managed challenge, distinguish infrastructure behavior from a confirmed storefront failure.

## Deployment and documentation changes

A squash merge to `main` can trigger production. Active GitHub ruleset `20717491` requires a pull request, nine current checks, one approval, resolved threads, linear history, and squash-only merges. It blocks direct pushes, force-pushes, and deletion. The owner bypass works only through a pull request; it does not permit direct pushes.

The [Netlify deploy management documentation](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#skip-a-deploy) confirms that `[skip netlify]` can appear anywhere in the most recent commit message. The marker applies to all commits in that push. The next commit without a skip marker can deploy the accumulated source tree, including skipped documentation.

Use the skip marker only when the diff cannot change the built storefront or runtime. After a skipped push, prove the production deploy ID, source commit, domains, and live fingerprint remain unchanged.

## Current dependency baseline

The August 11 release migrated the storefront to Next.js 16.3.0 and React 19.2.8. This removed the inherited Sharp advisory. The full and production-only npm audits both reported zero known vulnerabilities during this verification. Keep Dependabot, dependency review, pinned workflow actions, and the npm-audit gate active. Future major migrations still require full local, preview, and production verification. Do not use `npm audit fix --force` as a release shortcut.

## Task-specific references

- **Documentation map**: `docs/README.md`
- **Brand and design**: `docs/AHA-DESIGN-SYSTEM.md`, `.impeccable.md`
- **Commerce architecture**: `docs/commerce-operations.md`
- **Product factory**: `docs/product-factory.md`
- **Database changes**: `db/README.md`
- **Historical evidence**: `docs/archive/2026-08-10-house-cleaning/`, opened only when a task names it

Archived documents can describe retired phases, routes, products, branches, deploys, operations, and visual directions. They do not override this file or current external evidence.

## Maintenance rule

Keep this file concise. Update it only for durable, verified routing, production, safety, or operational facts. Do not append session history. Git history and the central LiFi fleet manifest preserve housekeeping and recovery evidence.
