# SOURCE_OF_TRUTH.md - After Hours Agenda

Last verified: 2026-07-08 by Codex.

**GitHub `main` is canonical. The production Netlify project must serve builds from this repo only.** Local clones and manual deploy artifacts are disposable.

## Production linkage

- GitHub repo: `https://github.com/omgitsthedm/aha-website.git`
- Host: Netlify
- Netlify project name: `afterhoursagenda`
- Netlify site id: `275b4115-16bf-42fb-9b36-6bce9bb93608`
- Netlify dashboard: `https://app.netlify.com/projects/afterhoursagenda`
- Default Netlify URL: `https://afterhoursagenda.netlify.app`
- Brand/custom URL: `https://www.afterhoursagenda.com/`
- Build command: `npm run build`
- Publish dir: `.next`
- Current deploy mechanism: exact-site Netlify CLI deploy to site id `275b4115-16bf-42fb-9b36-6bce9bb93608` until Git-based Netlify deploys are repaired.
- Required target check before deploy: `npm run verify:netlify-site`
- Required live check after deploy: `npm run verify:netlify-live`

## Source layout

- App Router pages/routes: `app/`
- UI/components: `components/`
- Commerce integrations: `lib/square/`, `lib/printful/`
- Static assets: `public/`
- Build output (gitignored, do not hand-edit): `.next/`

## Secrets

- `.env*` files are gitignored and must not be inspected or committed.
- Real values belong in Netlify environment variables or the approved password manager.
- Commit only non-secret public configuration, such as `NEXT_PUBLIC_SITE_URL`.

## Branches / archives

- `main` = canonical source branch.
- `feature/retro-grunge-block-overhaul` = current redesign/restoration work.
- `backup/consolidation-20260629` = preserved baseline from pre-overhaul consolidation.

## Notes / history

- 2026-07-08 wrong-site incident: `https://afterhoursagenda.netlify.app/` was serving unrelated Pole Position IT content even though this repo had not been merged or deployed for the redesign.
- Netlify evidence: the `afterhoursagenda` site had empty `build_settings`, `quick_setup_in_progress: true`, `prevent_non_git_prod_deploys: false`, and the published deploy had `commit_ref: null`, `branch: null`, and `commit_url: null`.
- Recent deploy metadata on the same site included an unrelated title, `Launch NYC Apartment Search VERA dashboard`, also with null commit/branch metadata.
- Root cause: the Netlify project was not Git-backed and accepted production deploy state outside the repo pipeline, so GitHub branch protections, PR review, and repo naming discipline could not protect the live `.netlify.app` URL.
- Prevention rule: never deploy AHA by site name alone. Use the exact site id, run the target guard before deploy, run the live guard after deploy, and repair Netlify Git linking before relying on push-to-main deploys.
