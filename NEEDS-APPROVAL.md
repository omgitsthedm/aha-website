# Approval queue — none of these actions executed

## 1. Replace the live After Hours Agenda property with LFNYC

**Approval must explicitly cover replacing the AHA website at `afterhoursagenda.com`.** This is not the separate `littlefightnyc.com` property. No DNS change is needed for this prepared path. Moving the work to a different site/domain requires that exact target first; no destination is guessed.

Preparation is complete: `lfnyc/ops/production.netlify.toml` changes the build base to the new static app, removes the root Next.js plugin declaration, selects Node 24, publishes `dist`, and sets the deliberate production flag. The build guard rejects an unapproved production context. The approved variant changes canonical origin, crawler directives, the preview banner and social card; it retains the local email-draft behavior. The approved public variant allows Google-Extended, which covers both Gemini grounding and training; the draft denies it. Other search crawlers remain crawlable, and GPTBot/ClaudeBot training access stays denied.

Before merge, on **site `275b4115-16bf-42fb-9b36-6bce9bb93608` only**, open Project configuration → Developer settings → Build plugins and disable **`@netlify/plugin-nextjs`** if still installed in the UI. Read-only API inspection confirms the site reports that plugin. Removing the root declaration alone is insufficient if the UI installation remains. Do not change any other integration, provider, secret or database setting.

Run only after that explicit production approval and plugin change:

```bash
cd '/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/worktree'
git switch audit/2026-10-09
git fetch origin main
test "$(git rev-parse origin/main)" = c682761ef26bbedb4ea4f76fc869e7ded883a12d
cp lfnyc/ops/production.netlify.toml netlify.toml
git add netlify.toml
git commit -m 'build: prepare approved LFNYC production migration [skip netlify]'
git push origin audit/2026-10-09
gh pr create --repo omgitsthedm/aha-website --base main --head audit/2026-10-09 --title 'Launch approved Little Fight NYC replacement' --body-file lfnyc/ops/promotion-pr.md
gh pr checks audit/2026-10-09 --repo omgitsthedm/aha-website --watch
LFNYC_APPROVED_HEAD="$(git rev-parse HEAD)"
gh pr merge audit/2026-10-09 --repo omgitsthedm/aha-website --squash --match-head-commit "$LFNYC_APPROVED_HEAD" --subject 'feat: launch approved Little Fight NYC website'
```

The `test` deliberately stops if main has changed: reconcile and rerun validation before continuing. A failing PR check also blocks the merge. Run the steps as a gated sequence, not an unattended paste that continues after failures. The final merge triggers the existing Git-connected Netlify production build. No `--prod` command or manual promotion is used; the reviewed draft contains intentional noindex metadata and must never be promoted unchanged.

After the approved main build succeeds, verify `https://afterhoursagenda.com/release.json` reports production, the exact source commit and site ID; verify the host's published deploy commit matches Git main; check all routes and headers, absence of noindex, sitemap origin, and zero commerce functions. Record the new deploy receipt. If any production check fails, restore the previous published deploy `6ac793e13b19850008db4a3a` through the exact site's Deploys interface under the same explicit release/rollback authorization. Do not change provider data.

## 2. Enable an automatic lead inbox, if wanted later

No missing credential blocks the delivered preview. The contact flow works now by preparing a local email draft to `hello@littlefightnyc.com`, with call, text and copy fallbacks. It never silently sends anything.

The separately gated change is to add a verified LFNYC-owned delivery service, recipient, server-side validation, abuse controls, success/error states and updated privacy terms. AHA's Netlify forms, customer database and Resend configuration must not be reused. No exact credential-bearing command is fabricated before that service is selected. This is an optional future feature, not a broken form.

## 3. Retire old commerce infrastructure, if the business chooses to

The new artifact excludes every AHA API, function, migration, catalog and provider library. Original source and data remain available for recovery. Deleting or disconnecting Square, APLIIQ, Printful, Resend, Netlify Database, webhooks or stored records is a separate destructive business change. The exact proposed scope is **no deletion and no provider change** for this release. Any later retirement requires an inventory, a verified private backup and named resources; there is no safe blanket deletion command.

## 4. Posting and search submissions

The full marketing batch is prepared locally. No post, email, search-console submission or campaign was sent. Publishing the static social batch and submitting an approved live canonical sitemap are separate external actions, after the production/domain decision. No spend, account creation or billing change is queued or required.
