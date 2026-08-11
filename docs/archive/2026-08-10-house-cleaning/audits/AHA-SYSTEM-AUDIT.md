# AHA System Audit

Baseline: 2026-07-10. Status: active audit, not a completion claim.

## Verified identity

- Canonical repo: `/Users/davidmarsh/Code/LiFi NYC/Clients/After Hours Agenda/Website/aha-website`
- Branch/HEAD: `main` at `4b1862f5b52692de262835beee0003b7b7e7b44b`, clean and aligned with `origin/main`
- Production deploy: Netlify deploy `6a4f7e5e51bb6d00086854d8`, ready, commit-backed to the same HEAD
- Live: `https://afterhoursagenda.com` and `https://afterhoursagenda.netlify.app` pass the exact-site live guard
- Risk: Tier 3 live commerce; production mutations remain approval-gated

## Findings

| Severity | Evidence | User/business impact | Location | Recommended action | Approval | Verification | Status |
|---|---|---|---|---|---|---|---|
| Critical | Square subscription uses `https://afterhoursagenda.netlify.app/api/webhooks/square`; Netlify production uses `https://www.afterhoursagenda.com/api/webhooks/square` | Legitimate payment/order events can fail signature verification, breaking reconciliation | Square metadata; Netlify production env; `app/api/webhooks/square/route.ts` | Align both sides to one non-redirecting canonical URL | Required: live config | Read-only metadata comparison, then signed fixture/live-safe receipt after approval | Open |
| Critical | Production token returns `403 FORBIDDEN` for Orders search and Orders calculate while Locations/Catalog reads succeed | Current checkout cannot calculate tax or create the Square order required before payment | Read-only `npm run verify:commerce-capabilities:netlify` | Grant/replace the credential with required Orders permissions, then rerun capability gate | Required: Square/Netlify credential change | Orders calculate returns 200 without record creation | Open |
| Critical | Baseline checkout displayed subtotal while the server could charge Square's destination-tax total | Customer could be charged more than shown | quote/payment routes and `CheckoutForm.tsx` | Quote with the same order shape, display final tax-inclusive total, reject drift | Local fix allowed; live checkout test gated | Unit/build passed; taxed sandbox transaction pending | Fixed locally, not deployed |
| High | GitHub CI, E2E, and security runs for HEAD failed with zero executed steps and no logs | Required merge/release gates provide no assurance | GitHub Actions runs `29013228564`, `29013228549`, `29013228535` | Diagnose repository/organization Actions runner or billing policy; rerun gates | May require account owner | Jobs execute steps and report real results | Open |
| High | Canonical state docs still identify July 8 commit/deploy as current | Agents can act from stale production truth | `.ai/STATE.md`, `SOURCE_OF_TRUTH.md`, takeover docs | Refresh after audit with evidence | No, documentation only | Cross-check Git, Netlify, GitHub | Open |
| High | The assumed native Printful store is unverified and the current token exposes only the Square-integrated store | Product creation cannot safely complete the provider mapping | `provider-registry.json`; `create-product.mjs` | Block live creation until a verified Manual/API store and direct-ID registry transaction exist | Remote mutation tests gated | Store capability preflight | Blocked safely |
| High | Baseline generated registry had duplicate products/slugs/variant IDs from querying the same Printful store twice and joining by name/size | Wrong PDP routing and wrong fulfillment mapping were possible | `populate-maps.mjs`; generated data validators | Exact join on Printful `external_id` to Square variation ID; one store query; global uniqueness gates | No | Rebuild plus all map/product validators | Fixed locally, not deployed |

## Positive findings

- Exact Netlify target guard is present and passes.
- Baseline local lint, typecheck, unit tests, validations, and production build passed; changed-tree full gates are being rerun.
- Production deployment is Git-backed to current `main`.
- Netlify DB, webhook ledger schema, order records, payment records, and audit records exist.
- The inactive `.ai/LOCK.md` does not indicate an active file collision.
- The new capability probe verifies API behavior without creating orders or exposing tokens.

## Immediate sequence

1. Finish evidence inventories.
2. Complete changed-tree unit, type, lint, build, browser, and accessibility verification.
3. Keep unverified/unprofitable catalog rows quarantined.
4. Repair remaining local issues without deploying.
5. Request scoped approval only for live webhook alignment and controlled transaction checks.
