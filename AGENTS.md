# LFNYC preview and preserved AHA agent contract

This branch adds the LFNYC static preview in `lfnyc/`; AHA production remains separate and unchanged. Read this file and `SOURCE_OF_TRUTH.md` before working. The current user request authorizes this audit branch, commits, branch pushes and a draft-only deploy; it does not authorize merging, production, DNS or commerce/provider writes.

## Canonical route

- **Local root**: `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website`
- **GitHub**: `https://github.com/omgitsthedm/aha-website.git`
- **Production branch**: `main`
- **Primary site**: `https://afterhoursagenda.com`
- **Current operational truth**: `SOURCE_OF_TRUTH.md`

Run `pwd -P`, `git rev-parse --show-toplevel`, and `git status --short --branch` before editing. Preserve unrelated work. There is no compatibility checkout; use this physical root and never treat a copied directory as a second source.

## LFNYC work in this branch

- Worktree: `/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/worktree` on `audit/2026-10-09`.
- Brand authority: `/Users/davidmarsh/Desktop/LiFi NYC/Business/Brand Kit`, including linked DESIGN.md. Use its tokens, fonts, mark, voice and hierarchy.
- Run `cd lfnyc && npm run check`, then `npm run test:e2e` with Node 24.21.0 and installed Chrome. Use dedicated ports 48378/48379.
- Exact preview site: `275b4115-16bf-42fb-9b36-6bce9bb93608`. Use only the static artifact with empty functions. Keep root production config unchanged.
- No contact submission, payment, analytics or provider request belongs in the preview. Preserve the email-draft disclosure.
- `NEEDS-APPROVAL.md` contains inactive migration steps. Approval is required before executing them.
- Existing AHA design/commerce references below apply only to preserved root source. They do not override the supplied LFNYC Brand Kit.

## Safety boundaries

- Protect Cart to Checkout to Payment to Confirmation above all other behavior
- Handle credentials only within explicit current task authorization; never print, commit or publish secrets, and preserve unrelated credentials and protected production data
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
