# After Hours Agenda source of truth

Last verified: August 10, 2026 from local Git, GitHub, the Netlify application programming interface (API), and public Hypertext Transfer Protocol Secure (HTTPS) checks.

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

## Service restoration and release baseline

- **Production deploy ID**: `6a679898148e9000086c19b3`
- **Deployed source commit**: `61946684db42559ba95dad43d718e2eb890c21fa`
- **Artifact state**: `ready`
- **Published**: July 27, 2026 at 17:44:07 UTC
- **Current availability**: HTTP 200 on the primary and default domains after Netlify service restoration
- **Release state**: the ready artifact above predates the validated August 10 cleanup and dependency patches on GitHub `main`

Public delivery has resumed. The first unskipped `main` push after restoration is the authorized Git-connected release of the accumulated, locally validated source. Do not declare source parity until that exact commit reaches a ready production deploy and the exact-site live checks pass. Dynamic commerce data can change independently, so compare the deploy ID, source commit, representative routes, and behavior before declaring drift.

## Runtime ownership

- **Storefront**: Next.js 15 App Router with TypeScript on Netlify
- **Payments and transaction records**: Square
- **Fulfillment and shipping lifecycle**: Printful through the current repository routing
- **Operational records**: Netlify Database
- **Transactional email**: the existing Resend outbox and templates
- **Product presentation and provider mappings**: this repository plus verified provider data

Never infer price, inventory, product availability, order state, or provider status from an old handoff. Read the current code and authorized provider state for the task.

## Production safety

- Never inspect or commit `.env*` or secret values
- Never fabricate a payment, order, customer, refund, fulfillment, shipment, provider event, email, or production form submission
- Keep Square and Printful tokens server-side
- Require verified payment before production fulfillment
- Keep preview, branch, local, and continuous integration contexts non-transactional
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

A normal push to `main` can trigger production. The [Netlify deploy management documentation](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#skip-a-deploy) confirms that `[skip netlify]` can appear anywhere in the most recent commit message and applies to all commits in that push. The next commit without a skip marker can deploy the accumulated source tree, including skipped documentation.

Use the skip marker only when the diff cannot change the built storefront or runtime. After a skipped push, prove the production deploy ID, source commit, domains, and live fingerprint remain unchanged.

## Known maintenance gate

The August 10 patch update resolved the Next.js, PostCSS, and Nano ID advisories without changing commerce code. The remaining production audit finding is Sharp `<0.35.0`, inherited through Next.js 15. Resolving it requires a major Next.js 16 upgrade under the current dependency graph. Do not run `npm audit fix --force` or override Next's Sharp range without a dedicated migration and full local, preview, and production verification.

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
