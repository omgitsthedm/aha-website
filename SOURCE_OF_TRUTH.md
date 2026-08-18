# After Hours Agenda source of truth

Last verified: August 18, 2026 from local Git, GitHub, the Netlify application programming interface (API), public Hypertext Transfer Protocol Secure (HTTPS) checks, the Square catalog, and the APLIIQ Design API.

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

## APLIIQ capsule — live storefront

- **Storefront**: eight capsule products sell on `afterhoursagenda.com` — Black Sheep, No Kings, Read Banned Books, Don’t Lick The Boot, Don’t Fuck Fascists (Next Level 3600 tees, $40), Sheep Min and Enemy Of The State (Independent IND4000 hoods, $60; 5XL $70), and No Place Like New York (Independent IND3000 crewneck, $60). All black, all sizes the blank offers.
- **APLIIQ designs carry the artwork.** Each product is a real APLIIQ design created through the documented Design API with the print file attached (`POST /Artwork` then `POST /Design`; SKUs end in `A1`, never `A0`). Design ids, artwork ids and per-size APQ SKUs are recorded in `data/apliiq-capsule-designs.json`; the sellable registry is `data/apliiq-map.json`; the product spec is `data/apliiq-capsule.json`. `npm run apliiq:capsule -- create|map` is the only path from art to a sellable variant.
- **Square** holds one active `REGULAR` item per capsule product with a size variation per APQ SKU, three images (studio front, print detail, flat artwork — the storefront gallery reads them in that order) and the authored product story in `description_html`; the 120 legacy items remain archived.
- **Order path**: Cart → Square payment → internal order → APLIIQ order submission is **live** in production: `AHA_FULFILLMENT_MODE=auto`, `APLIIQ_ALLOW_CREATE_ORDERS=true`, `APLIIQ_LIVE_MODE=true`, `SQUARE_ENVIRONMENT=production`, `CONTEXT=production`. A paid order is POSTed once to APLIIQ; ambiguous outcomes park in manual review; the scheduled `reconcile-orders` function polls APLIIQ order status every 15 minutes because the APLIIQ fulfillment callback URL is not yet registered in the APLIIQ dashboard.
- **APLIIQ account state**: auto-processing is OFF in the APLIIQ dashboard, so APLIIQ holds each submitted order for their release; the saved fulfillment card is charged at processing. Private label `SB-2-155690` is requested in the production note; the label subscription is not attached to the API designs.
- **Shipping markets**: US free; the 22 international markets in `INTERNATIONAL_COUNTRIES` at the $25 flat rate. The checkout country select and the APLIIQ country name both derive from `SHIPPING_COUNTRY_NAMES`.
- **Voice and type**: the site is written and shot for women first — she is the buyer, for herself and for the people she buys for; men appear as the gift, never the hero. Headlines, product names and pull-quotes set in Instrument Serif (`--font-editorial`, `.editorial-title`); Poppins Black is the wordmark and utility labels; JetBrains Mono for metadata. Rose is the one accent — buttons and a single emphasis per screen. Imagery sits in `.frame` (hairline, no fold, no shadow).
- **Editorial imagery** (home hero, story, category tiles, lookbook, signature, archive) is registered in `data/brand-imagery.json`; each slot carries `placeholder` and `source`. Today the rooftop and subway frames are AI-generated placeholders, the Black Sheep on-model pair is a print-provider render of the previous run, and the archive strip is real 2012–2014 brand material. Product imagery lives in Square. `docs/content-swap-guide.md` is the launch swap procedure; `scripts/square-capsule.mjs`, `scripts/apliiq-capsule.ts` and `scripts/imagery/*` are the tools.
- **Storefront navigation** is a centred wordmark with Shop · Lookbook · About on the left and Search · Bag on the right (Tees / Hoods & Crews are pills on the shop; Manifesto and Track order live in the footer and mobile menu). The home page opens on a split hero — her (the buyer) left, the gift right — with small captions and no headline, then the brand line as a statement. The gender routes (`/men`, `/women`, `/unisex`) and empty categories (`/accessories`, `/new-arrivals`, sweaters) still resolve but are unlinked and out of the sitemap; the shop hides search, size, sort and index chrome while the catalog holds twelve pieces or fewer.
- **Legacy catalog** stays dark and unsellable, enforced per provider. Retired product, product-media, Printful-art and campaign URLs return `404`.
- Read the deployed commit from `https://afterhoursagenda.com/release.json`; compare it with `git rev-parse origin/main` before declaring drift.

## Runtime ownership

- **Storefront**: Next.js 16.3.0 App Router, React 19.2.8, and TypeScript on Netlify
- **Payments and transaction records**: Square
- **Fulfillment and shipping lifecycle**: the provider-neutral repository dispatcher; APLIIQ is the live provider for the capsule, while Printful records and routing remain available for historical paid orders only
- **Operational records**: Netlify Database
- **Transactional email**: the existing Resend outbox and templates
- **Product presentation and provider mappings**: this repository plus verified provider data; no APLIIQ variant is sellable without a committed approved mapping (real `A1` APQ SKU, verified landed cost) and an active Square variation

Never infer price, inventory, product availability, order state, or provider status from an old handoff. Read the current code and authorized provider state for the task.

## Production safety

- Never inspect or commit `.env*` or secret values
- Never fabricate a payment, order, customer, refund, fulfillment, shipment, provider event, email, or production form submission
- Keep Square, APLIIQ, and Printful tokens server-side
- Require verified payment before production fulfillment
- Keep preview, branch, local, and continuous integration contexts non-transactional
- Require all five APLIIQ submission rails: Netlify production context, Square production, automatic fulfillment mode, explicit APLIIQ create-order permission, and APLIIQ live mode
- Never automatically resubmit an APLIIQ request after a timeout, acceptance without a provider order ID, or any other ambiguous outcome; route it to manual review
- Do not register the APLIIQ product callbacks until their URL-token behavior has been proven in a controlled provider test; the fulfillment callback should be registered in the APLIIQ dashboard so tracking pushes instead of polls
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
