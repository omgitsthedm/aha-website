# Approval queue — none of these actions executed

## 1. Production runtime migration, preserving the AHA brand

The current preview is After Hours Agenda. The original custom domain, business identity and production deployment remain unchanged. This draft does not authorize a production merge.

The prepared static migration changes the build base to `site-preview`, uses Node 24 and ships no functions. **It is a breaking runtime change:** automatic newsletter signup, automated order lookup, operational APIs and provider callbacks are not in the static application. The safe remedy for preview is complete: no customer queries or submissions, a working local email draft, clear collection status and support guidance. Before production, the owner must explicitly accept the reduced runtime or approve a separate backend-preservation implementation. Existing customer/order/provider data is not deleted or changed. Do not infer that closing new sales makes every historical endpoint safe to remove.

The exact proposed change is `cp site-preview/ops/production.netlify.toml netlify.toml`. The template changes the publish target to the static app, removes the root Next.js plugin declaration, sets Node 24, and enables the deliberate production build flag for `https://afterhoursagenda.com`. It keeps AHA branding and email. The tested production variant removes the review banner/noindex and uses the approved canonical origin. It allows Google-Extended for Gemini grounding, which also allows Google's covered training use; GPTBot and ClaudeBot remain denied.

Before any approved merge, on **site `275b4115-16bf-42fb-9b36-6bce9bb93608` only**, open Project configuration → Developer settings → Build plugins and disable `@netlify/plugin-nextjs` if still installed. Current read-only metadata reports that plugin. No other integration, data or secret setting is changed.

Only after explicit production approval covering the runtime changes above and that plugin step:

```bash
(
set -e
cd '/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/worktree'
git switch audit/2026-10-09
git fetch origin main
test "$(git rev-parse origin/main)" = c682761ef26bbedb4ea4f76fc869e7ded883a12d
cp site-preview/ops/production.netlify.toml netlify.toml
git add netlify.toml
git commit -m 'build: prepare approved AHA production migration [skip netlify]'
git push origin audit/2026-10-09
gh pr create --repo omgitsthedm/aha-website --base main --head audit/2026-10-09 --title 'Launch approved After Hours Agenda modernization' --body-file site-preview/ops/promotion-pr.md
gh pr checks audit/2026-10-09 --repo omgitsthedm/aha-website --watch
AHA_APPROVED_HEAD="$(git rev-parse HEAD)"
gh pr merge audit/2026-10-09 --repo omgitsthedm/aha-website --squash --match-head-commit "$AHA_APPROVED_HEAD" --subject 'feat: launch approved After Hours Agenda website'
)
```

The subshell stops on failure. The `test` stops if main has changed; reconcile and revalidate before continuing. Required PR checks and repository approval rules must pass. A main merge triggers the Git-connected production build. Never manually promote the noindex draft unchanged. No DNS or domain change is needed or authorized.

After the approved build, verify the public `release.json` source/site/mode, exact Netlify published deploy, Git main, every route and header, sitemap origin, noindex removal, and the accepted backend/support behavior. If verification fails, restore published deploy `6ac793e13b19850008db4a3a` through this exact site's Deploys interface under the release/rollback authorization. Do not alter provider data.

## 2. Restore automatic acquisition and order lookup, if required for production

The original implementations remain in the preserved root application. No existing integration is disconnected. A future scoped implementation must retain AHA-owned recipients/accounts, server-side validation, abuse controls, appropriate consent and truthful success/error states. Newsletter tests must not actually subscribe anyone; order tests must use an approved non-production fixture. No LFNYC or future-client destination belongs in this project's flows.

## 3. Live commerce and provider retirement

Do not reopen checkout, publish products, change inventory, prices or mappings, create transactions, modify callbacks, retire providers or delete records. Those actions require separately named resources, verified readiness and explicit scope. No blanket deletion or provider-mutation command is prepared because no such change is part of this release.

## 4. External publication and account changes

The complete AHA marketing batch is local and unpublished. No post, email, campaign or search-console submission was sent. Posting and submission of a future live sitemap remain separate external actions. No spend, billing, account creation, DNS or hosting change is required.
