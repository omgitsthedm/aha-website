# Release gate — independent GitHub review

The user reviewed the AHA preview and said: “that's good, push forward and document it and then close it.” The release candidate is prepared on `audit/2026-10-09`. The website keeps the After Hours Agenda identity and domain.

## Remaining mandatory gate

GitHub ruleset **20717491** requires **one independent approving review**, resolved review threads, an up-to-date branch, and these checks: `ci`, `product-flow`, `cart-flow`, `checkout-sandbox-flow`, `dependency-review`, `npm-audit`, `secret-scan`, `Lighthouse (mobile)`, and `Lighthouse (desktop)`. Auto-merge is disabled. This is a repository control, not a request for another conversational approval. Do not self-approve, use an admin bypass, weaken the rule or publish an unmerged artifact around it.

All implementation and local validation are prepared before this gate. The PR review must cover the disclosed static runtime migration: automated newsletter signup, customer order lookup, operational APIs and provider callbacks are excluded. The contact flow prepares an unsent email; new orders stay paused. Original code, provider/customer records, accounts and credentials remain unchanged. No provider retirement or commerce reopening is authorized.

## Exact remaining sequence after independent review

The static root configuration is already committed on the audit branch. It uses Node 24, the exact production origin, the deliberate production flag and `NETLIFY_NEXT_PLUGIN_SKIP=true`. The skip flag was verified against every lifecycle hook in installed runtime 5.16.2 and current upstream source; no live UI plugin mutation is needed. Search ownership files are preserved byte for byte.

```bash
(
set -e
cd '/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/worktree'
git switch audit/2026-10-09
git fetch origin main
test "$(git rev-parse origin/main)" = c682761ef26bbedb4ea4f76fc869e7ded883a12d
gh pr checks audit/2026-10-09 --repo omgitsthedm/aha-website --required
AHA_APPROVED_HEAD="$(git rev-parse HEAD)"
gh pr merge audit/2026-10-09 --repo omgitsthedm/aha-website --squash --match-head-commit "$AHA_APPROVED_HEAD" --subject 'feat: launch reviewed After Hours Agenda website'
)
```

The main check stops if another release lands; reconcile and rerun checks. Use a merge subject without `[skip netlify]`. The Git-connected main build targets exact site **275b4115-16bf-42fb-9b36-6bce9bb93608**. Never manually promote the noindex draft. A failed build leaves the existing published deployment intact; fix the build and retry the approved Git source.

After the successful build, read the exact Netlify published deploy and source, then run `EXPECTED_COMMIT=<merged-main-sha> node site-preview/scripts/verify-live.mjs`. Run production-mode browser checks with `AHA_PRODUCTION_BUILD=approved BASE_URL=https://afterhoursagenda.com npm run test:e2e` from `site-preview/`. Verify all routes, ownership files, canonicals, noindex removal and the accepted static support behavior. Record the exact deploy ID, source/digest and credit effect. Do not submit forms, query customers or create transactions.

## Actions outside this release

No DNS/domain change, billing or spend, account creation, provider mutation, inventory/catalog publication, payment, refund, fulfillment, deletion, campaign or social posting is authorized. The marketing package remains unpublished. A future backend restoration needs its own scope and non-production fixtures; preserving historical source is not a live-service claim.

Sources for the non-disruptive plugin preparation: [Netlify build variables](https://docs.netlify.com/build/configure-builds/environment-variables/) and [current runtime source](https://github.com/opennextjs/opennextjs-netlify/blob/main/src/index.ts). The local runtime's actual implementation was read and exercised; this does not rely on the older v4-only wording in the general documentation.
