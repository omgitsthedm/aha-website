# After Hours Agenda agent contract

After Hours Agenda is a live commerce storefront. Read this file and `SOURCE_OF_TRUTH.md` before working. No other file is mandatory startup context.

## Canonical route

- **Local root**: `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/aha-website`
- **GitHub**: `https://github.com/omgitsthedm/aha-website.git`
- **Production branch**: `main`
- **Live site**: `https://afterhoursagenda.com`
- **Current operational truth**: `SOURCE_OF_TRUTH.md`

Run `pwd -P`, `git rev-parse --show-toplevel`, and `git status --short --branch` before editing. Preserve unrelated work. The compatibility path under `Website/aha-website` may resolve to this same physical checkout; never treat an alias as a second source.

## Safety boundaries

- Protect Cart to Checkout to Payment to Confirmation above all other behavior
- Never inspect or edit `.env*`, secrets, credentials, keychains, or protected production data
- Never create a live payment, order, customer, refund, fulfillment, email, form submission, or analytics event during agent verification
- Do not change products, prices, inventory, mappings, Square, Printful, Netlify, Domain Name System (DNS), database, email, analytics, or commerce behavior without clear scoped authorization
- Do not push, deploy, merge, or change live systems unless the current request authorizes the exact action
- Treat `lib/square/`, `lib/printful/`, `lib/commerce/`, `app/api/`, cart, checkout, webhooks, and operations routes as high risk
- Never restore retired catalog, brand, or editorial material from historical handoffs without current approval

Public `GET` and `HEAD` checks, name-only readiness checks, and read-only Git, GitHub, and Netlify inspection are observational. Checkout, submissions, provider calls, and production writes are transactional.

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run validate:all
npm run build
npm run verify:netlify-site
LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live
npm run verify:commerce-readiness:netlify
```

Use the smallest validation set that proves the task. Run the exact-site guard before release work. Never use live checkout as a smoke test.

## On-demand references

- Documentation map: `docs/README.md`
- Brand and interface work: `docs/AHA-DESIGN-SYSTEM.md` and `.impeccable.md`
- Commerce architecture: `docs/commerce-operations.md`
- Product creation: `docs/product-factory.md`
- Database changes: `db/README.md`
- Historical evidence: `docs/archive/2026-08-10-house-cleaning/`, opened only when a task names it

Archived handoffs, plans, operations guides, and dated audits are not current instructions. When a reference conflicts with Git, current Netlify metadata, the live site, or `SOURCE_OF_TRUTH.md`, verify the external truth and update only the current contract.

## Completion

Finish with a clean, synchronized branch when authorized and technically possible. Report changed files, validation, production impact, risks, and the next action only when one remains. Do not create session diaries, status logs, or new handoffs inside this repository.
