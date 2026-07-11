# AHA QA Matrix

Baseline: 2026-07-10. `Not run` is not a pass.

| Area | Scenario | Environment | Current evidence | Status | Gate/approval |
|---|---|---|---|---|---|
| Repo | Canonical main checkout | Local | Canonical resolved root used; intentional local implementation changes are uncommitted | Pass locally | Commit/push remains user-controlled |
| Deploy | Exact site and current commit | Netlify | Site guard passes; deploy `6a4f7e5...` at HEAD | Pass | Read-only |
| Live | Apex and Netlify URLs serve AHA | Production public GET | Both live guards pass | Pass | Observational |
| Lint | ESLint CLI | Local | `eslint --max-warnings=0 app components lib scripts tests` passes | Pass | None |
| Type | TypeScript | Local | `tsc --noEmit` passes | Pass | None |
| Unit | Commerce, feed, fulfillment, webhook gates | Local | 21 tests across 7 files pass | Pass | None |
| Data | Product/Square/Printful maps | Local | 100 products / 994 variants active after exact-ID and profit gates | Pass | None |
| Build | Next 15.5.20 production build | Local | 28 routes generated successfully | Pass | None |
| Security | Production dependency audit | Local | `npm audit --omit=dev`: 0 vulnerabilities after Next/PostCSS patching | Pass | None |
| CI | CI/E2E/security jobs execute | GitHub | All HEAD jobs failed with zero steps | Fail | Account/runner diagnosis |
| Checkout | Displayed total equals charged total | Local/sandbox | Quote/payment share order shape; drift fails closed | Partial | Taxed sandbox transaction gated if it creates records |
| Webhook | Square URL exact match | Production metadata | Mismatch confirmed | Fail | Live change approval required |
| Square | Orders calculate permission | Production read-only probe | 403 insufficient permissions | Fail | Credential/scope change approval required |
| Webhook | Signature fixture/replay/dedupe | Local | Signature and durable-outcome unit fixtures pass; DB replay integration pending | Partial | None with fixtures |
| Fulfillment | Paid order creates one safe draft per store | Fixture/dry-run | Per-store state and confirmation policy fixtures pass; DB/provider integration pending | Partial | Live mutation gated |
| Fulfillment | Multi-store webhook reconcile | Fixture | Per-store fulfillment rows and aggregate status implemented | Partial | DB integration pending |
| Product create | Dry-run validation | Local | Exact provider store is unverified; live mode fails closed | Blocked safely | Verify Manual/API store first |
| Product create | Partial failure/retry | Fixture | No durable receipt/rollback | Fail | Remote mutation gated |
| Browser | Desktop Chromium | Local production server | Home render inspected; no overflow, one H1, complete image alt, named controls | Pass | None |
| Browser | Desktop WebKit | Local | Not run | Not run | None |
| Browser | Mobile Chromium 390x844 | Local production server | Home, shop, PDP, modal, drawer, bag, menu, and checkout inspected; no overflow | Pass | None |
| A11y | axe and keyboard dialog/nav behavior | Local production server | Axe 4.12.1: 0 violations on home, shop, PDP, cart; Escape/focus restore/scroll lock manually exercised | Pass for covered scope | VoiceOver and 200% zoom remain manual follow-up |
| Performance | Lighthouse home and PDP | Local production server | Home: 92 perf / 100 a11y / 100 BP / 100 SEO; PDP: 94 perf / 100 a11y / 100 SEO; CLS 0, TBT 0 | Pass locally | Preview/live measurement remains useful |
| Links | Critical conversion controls | Local production server | Product to modal to drawer to bag to checkout, catalog pagination, mobile menu, canonical, feed, sitemap, robots exercised | Pass for covered scope | Full automated link crawl remains optional |

## Release blockers currently open

1. Square Orders API permission.
2. Square webhook URL alignment.
3. Taxed checkout integration proof.
4. DB-backed multi-store fulfillment/replay integration proof.
5. GitHub Actions executing zero steps.
6. WebKit, VoiceOver, 200% zoom, and live-preview browser evidence are not yet captured.
7. Pricing/product decisions for 188 quarantined variants; no live price changes without approval.
