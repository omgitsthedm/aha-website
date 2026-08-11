# CI Gates & Branch Protection — After Hours Agenda

GitHub is the release-control system (§12). Workflows live in `.github/workflows/`.

## Workflows
| File | Purpose |
|---|---|
| `ci.yml` | lint · typecheck · unit-tests · build · product-data-validation · square-map-validation · printful-v2-map-validation · margin-check |
| `e2e.yml` | Playwright: product-flow · cart-flow · checkout-sandbox-flow (Sandbox only; cart/checkout specs land Phase 2-3) |
| `lighthouse.yml` | performance budgets (LCP/INP/CLS) on `/` and `/shop` |
| `security.yml` | dependency-review · npm-audit · secret-scan (gitleaks) |
| `release.yml` | on `v*` tag: verify live site + changelog + GitHub release |

CI never creates live charges, confirms live Printful orders, or uses production secrets — Sandbox + mocked payloads only.

## Branch protection to enable on `main` (David — GitHub → Settings → Branches)
Require a PR before merge; require branches up to date; require conversation resolution; no direct pushes; linear history. **Required status checks:**

```
ci / lint
ci / typecheck
ci / unit-tests
ci / build
ci / product-data-validation
ci / square-map-validation
ci / printful-v2-map-validation
ci / margin-check
e2e / product-flow
e2e / cart-flow
e2e / checkout-sandbox-flow
security / dependency-review
security / secret-scan
lighthouse / performance
```

## Branch model
`main`=production · `staging`=persistent branch deploy · `feature/*`=Deploy Preview · `drop/*`=drop preview · `hotfix/*`=urgent prod fix.

> Note: the existing `claude.yml` / `claude-review.yml` workflows are unrelated (Claude Code Review) and left intact.
