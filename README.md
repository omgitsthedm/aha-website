# After Hours Agenda — published website

**Published:** https://afterhoursagenda.com — deploy `6ac8bf631f5bb00008938cac`, source `7a23f9846a337de2ac85bb34014d5b3f983ca71c`. All 16 routes and nine live browser suites passed on October 9, 2026. Orders remain paused as reviewed.


After Hours Agenda keeps its own identity and custom domain. The reviewed website lives in **`site-preview/`**, using Astro 7.3.8 and Node 24.21.0. The owner explicitly approved this production release on October 9, 2026. All nine required checks must pass; the existing named-owner PR exception is authorized for this release only. `SOURCE_OF_TRUTH.md` explains how to verify the actual live state.

## Work and verify

```bash
cd site-preview
npm ci
npm run check
npm run test:e2e
AHA_PRODUCTION_BUILD=approved PUBLIC_SITE_URL=https://afterhoursagenda.com npm run check
AHA_PRODUCTION_BUILD=approved npm run test:e2e
npm run dev
```

Use Node 24.21.0. Dev uses port 48378; built-site checks use 48379 and installed Google Chrome. Preview and production tests enforce their own indexing/canonical mode. Tests cover every page, keyboard navigation, contact states, no-JavaScript content, reflow, accessibility, artifact integrity and unchanged Google/Bing ownership files. Build the corresponding mode immediately before its tests.

## Current customer-service candidate

The new buildout is **preview-only**. It adds direct support, returns and separate-consent newsletter forms; protected guest order lookup; collection/product/search/saved-item/bag interfaces; a guarded Square checkout adapter; fit guidance; unsubscribe; and optional aggregate measurement. See `COMMERCE-BUILDOUT-2026-10-09.md` for exact evidence and remaining launch inputs.

`src/data/launch-catalog.json` under `site-preview/` is empty and unapproved. New orders remain paused. Yikes and Insomniac are labeled development studies in preview only; their pages and images are excluded from production output. Product data needs material, fit, care, measured sizes, label/origin/QC evidence and approved provider variants. `npm run check:launch` returns 2 until source approvals exist. This is an intentional closed launch gate, not a failing application test.

Production-mode forms post to Netlify Forms; their event handler records newsletter consent without sending a welcome campaign. Order lookup matches order number, checkout email and postal code. Preview services use a fictional fixture and never read/write customer records. Local Postgres tests exercise all 14 historical migrations plus the new additive migration. Build staging preserves historical migration names and bytes. No hosted migration was manually applied.

The preserved payment, tax, durable-order, idempotency, signed-webhook and fulfillment code is bundled separately from static files. Authorization is not capture: an APPROVED Square payment waits for confirmation before fulfillment. Provider callbacks and scheduled work require explicit runtime flags on the exact published site. Preview and an empty launch manifest cannot accept payment.

Saved items and bag stay on the device. Optional measurement is off by default and respects GPC/DNT; it stores daily counts and performance buckets, not customer identities. `npm run report:metrics` needs a securely supplied database binding; it is not a public endpoint or a unique-customer report. Never put a connection string in Git or public output.

## Release

- GitHub: `omgitsthedm/aha-website`; production branch: `main`.
- Exact Netlify site: `275b4115-16bf-42fb-9b36-6bce9bb93608`; domain: `https://afterhoursagenda.com`.
- Root `netlify.toml` sets `base = "site-preview"`. Netlify then selects `site-preview/netlify.toml`; both files must keep build environments and contexts aligned. A merged commit is not live until its Git build publishes successfully.
- Review artifact: https://6ac8af91c681bfc763902db4--afterhoursagenda.netlify.app. It retains noindex and must never be promoted unchanged.
- Production builds explicitly require `AHA_PRODUCTION_BUILD=approved` and the exact AHA origin. `release.json` records the source, artifact digest and exact site.
- Required checks keep their established names. Original-app CI still validates the preserved source; browser/performance jobs test the static production candidate. Lighthouse CI uses the exact local build; hosted measurements are separately documented.
- GitHub normally requires one independent approval. For this owner-approved release only, the existing named-owner PR exception permits merging after all nine checks pass. No repository rule changes or fabricated reviews. `NETLIFY_NEXT_PLUGIN_SKIP=true` in the selected nested config keeps the older UI-installed Next runtime inert.
- Post-release verification: `EXPECTED_COMMIT=<deployed-main-sha> node site-preview/scripts/verify-live.mjs`, followed by production-mode browser checks on `BASE_URL=https://afterhoursagenda.com`.

`AUDIT-REPORT.md` is the dated audit receipt. `NEEDS-APPROVAL.md` records the approved scope and production verification sequence. New work returns to preview-first scope after this release.

## Preserved application

The original `app/`, `components/`, `lib/`, `data/`, `db/` and `ops/` remain in Git. Their provider and database operations are protected; do not run transactional probes or infer authorization to reopen commerce. The original checkout is preserved on its existing branch; all release work happens in the isolated audit worktree.
