# Current source and preview truth — October 9, 2026

- Original AHA checkout: `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website` (verified fleet route and Git root).
- Isolated LFNYC worktree: `/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/worktree`.
- GitHub: `omgitsthedm/aha-website`; preview branch: `audit/2026-10-09`; production branch: `main`.
- Baseline main: `c682761ef26bbedb4ea4f76fc869e7ded883a12d`, published October 8, 2026.
- Production Netlify deploy: `6ac793e13b19850008db4a3a`; site ID `275b4115-16bf-42fb-9b36-6bce9bb93608`.
- Live property remains `https://afterhoursagenda.com`; no production, DNS, provider or database change belongs to this preview mission.
- The production catalog is closed. Existing navigation also gates About/Lookbook links with the catalog; historical claims below that all those links remain visible are stale.
- New application: `lfnyc/`, static Astro 7.3.8, Node 24.21.0, zero functions. Draft origin: `https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app`.
- Draft source/artifact/deploy receipt and completed validation: `AUDIT-REPORT.md`. Exact approval-gated production migration: `NEEDS-APPROVAL.md`.
- Existing `littlefightnyc.com` production is a separate property and was not edited.

The original source below is retained for recovery of the AHA commerce contract. Its dated release, local path, provider state and availability statements are historical snapshots, not permission or current verification. Never use them to reopen commerce.

---

# Historical AHA operating reference

Last verified: September 28, 2026 from local Git, GitHub, Netlify deployment metadata, production-context build, and live primary plus immutable artifact checks. Provider catalog data was not changed.

The following September 28 snapshot is retained as a historical operational reference; current routing and release identity are above. Detailed design, commerce, legal, and historical evidence remains available on demand under `docs/` and in Git history.

## Canonical source and production map

- **Project**: After Hours Agenda production storefront
- **Canonical local checkout**: `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/05 Store and Website/Website Code`
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

## Current release state

- **Merged source**: main is b97318b4a045117dc8152f03d5b7ab815398b39d (September 28). It defaults automations off, removes the three recurring function schedules, and serves the contact-first acquisition surface with the catalog and checkout closed.
- **Current host artifact**: Netlify production deploy 6aba292b6d8fce4fd286d276 is live from main b97318b4a045117dc8152f03d5b7ab815398b39d. Both the primary domain and immutable artifact returned HTTP 200; the live functions schedule inventory is empty.
- **Build gate**: the production-context Netlify build completed with the Next adapter and function bundle. Separately, the prior catalog-read attempt reached only Square's read-only catalog search endpoint and received HTTP 401 while the required configuration name was present. The actual Square catalog and all provider data remain unchanged; preview catalog output is not a valid substitute for commerce.
- **Release receipt**: primary https://afterhoursagenda.com and immutable https://6aba292b6d8fce4fd286d276--afterhoursagenda.netlify.app both returned HTTP 200. release.json reported the exact production main commit. Primary home SHA-256 is 98193e1e30c4275dc5a6b656f409d12feaf5ddd3b9488e618c361585fe12f34e. Both Google verification files returned 200; sitemap returned 200 and excludes closed product routes. Restore Square catalog-read authorization before any separately authorized reopening of catalog or checkout.

## APLIIQ capsule — source contract while release is paused

- **Live storefront contract**: brand home, lookbook, contact, and newsletter acquisition remain available. Shop, product, bag, and checkout surfaces remain closed and direct visitors to truthful updates and support; no product, payment, order, or fulfillment path is live.
- **APLIIQ designs carry the artwork.** Each product is a real APLIIQ design created through the documented Design API with the print file attached (`POST /Artwork` then `POST /Design`; SKUs end in `A1`, never `A0`). Design ids, artwork ids and per-size APQ SKUs are recorded in `data/apliiq-capsule-designs.json`; the sellable registry is `data/apliiq-map.json`; the product spec is `data/apliiq-capsule.json`. The dry-run-first final path is `npm run publish:apliiq -- --slug <slug> [--apply]`: apply creates or skips the selected design, revalidates A1 SKUs, maps only that product, creates or resumes Square, and verifies local route/feed eligibility. New or redesigned variants require explicit dated mapping and sample approvals plus the exact post-design SHA-256 production fingerprint in the capsule spec; it binds slug, blank/color/location, design/artwork, service/note, private label, size guide, and all sorted size/APQ SKUs. Source preflight may prepare the design, but map/Square/manifest/site/feed activation remains blocked until that fingerprint is approved. Existing mapped variants preserve committed approvals only while their audited design/SKU/artwork/service/note/private-label/size-guide identity remains unchanged.
- **Square catalog record**: one active REGULAR item per historical capsule product, with mapped APQ SKU, images, and authored product story, remains provider-side reference data. It is not evidence of a live storefront while catalog and checkout are closed.
- **Order path after a separately authorized commerce reopening**: Cart to Square payment to internal order to APLIIQ submission remains a documented future contract only after Square catalog-read authorization is restored and the required production rails are re-verified. It is not the current release contract.
- **APLIIQ account state**: auto-processing is OFF in the APLIIQ dashboard, so APLIIQ holds each submitted order for their release; the saved fulfillment card is charged at processing. Private label `SB-2-155690` is requested in the production note; the label subscription is not attached to the API designs.
- **Shipping markets**: US free; the 22 international markets in `INTERNATIONAL_COUNTRIES` at the $25 flat rate. The checkout country select and the APLIIQ country name both derive from `SHIPPING_COUNTRY_NAMES`.
- **Voice** (`lib/content/brand-copy.ts`): a clothing brand for the dreamers and the doers — good people who work hard, love hard, and celebrate the life they’re building; for the community, for kindness. Warm, plain, generous, confident. Not desperate, not a cliché, not hung up on nightlife or a city (origin claims name no city — `ORIGIN_CLAIM_*` say only "made to order"). Written and shot for women first — she is the buyer, for herself and for the people she loves; men appear as the gift, never the hero. Headlines, product names and pull-quotes are large Poppins Black uppercase (`.editorial-title`, the brand kit's display voice; emphasis is rose, never italic); body Poppins ≥16px; JetBrains Mono ≥12px for metadata. Nothing on the site is set smaller than 12px. Rose is the one accent — buttons and a single emphasis per screen. Imagery sits in `.frame` (hairline, no fold, no shadow).
- **Editorial imagery** (home hero, story, category tiles, lookbook, signature, archive) is registered in `data/brand-imagery.json`; each slot carries `placeholder` and `source`. Today the rooftop and subway frames are AI-generated placeholders, the Black Sheep on-model pair is a print-provider render of the previous run, and the archive strip is real 2012–2014 brand material. Product imagery lives in Square. `docs/content-swap-guide.md` is the launch swap procedure; `scripts/square-capsule.mjs`, `scripts/apliiq-capsule.ts` and `scripts/imagery/*` are the tools.
- **Storefront navigation while commerce is closed**: the wordmark, editorial home, lookbook, about, contact, and newsletter paths remain available. Shop, Search, Bag, product links, and product imagery are absent; shop and direct bag paths render the support-and-updates surface. The historical open-store navigation and category behavior remain source reference only.
- **Legacy catalog** stays dark and unsellable, enforced per provider. Retired product, product-media, Printful-art and campaign URLs return `404`.
- Read the deployed commit from `https://afterhoursagenda.com/release.json`; compare it with `git rev-parse origin/main` before declaring drift.

## Runtime ownership

- **Storefront**: Next.js 16.3.6 App Router, React 19.2.8, and TypeScript on Netlify
- **Analytics**: Google Analytics property 546226118 remains in David Marsh account 45212792; no move is planned in this release.
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
