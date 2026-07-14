# SOURCE_OF_TRUTH.md - After Hours Agenda

Last verified: 2026-07-14 by Claude from local Git, Netlify API, and public HTTPS checks.

GitHub `main` is canonical. The production Netlify project must serve builds from this repo only. Local clones and manual deploy artifacts are disposable.

## Production Linkage

- GitHub repo: `https://github.com/omgitsthedm/aha-website.git`
- Canonical branch: `main`
- Current deployed commit: `3f46c061bdcdecddb2361ba1296feaafd695f653` (pending this commit; verify via Netlify API)
- Source PR: PR #2, `Prepare AHA Netlify commerce backend for cutover`, merged 2026-07-09 04:19:25 UTC.
- Host: Netlify
- Netlify project name: `afterhoursagenda`
- Netlify site id: `275b4115-16bf-42fb-9b36-6bce9bb93608`
- Netlify dashboard: `https://app.netlify.com/projects/afterhoursagenda`
- Default Netlify URL: `https://afterhoursagenda.netlify.app`
- Primary custom URL: `https://afterhoursagenda.com/`
- `www` behavior: `https://www.afterhoursagenda.com/` redirects to `https://afterhoursagenda.com/`
- Build command: `npm run build`
- Publish dir: `.next`
- Current deploy mechanism: Git-backed Netlify production deploys from `main`.
- Latest verified production deploy id: `6a4f2851e4c1b9fb71f86a67`
- Required target check before deploy: `npm run verify:netlify-site`
- Required environment readiness check before relying on commerce backend: `npm run verify:commerce-readiness:netlify`
- Required live check after deploy: `npm run verify:netlify-live`

## DNS And Domain

- Authoritative DNS provider reported by handoff: Wix DNS
- Nameservers:
  - `ns8.wixdns.net`
  - `ns9.wixdns.net`
- Apex A record: `afterhoursagenda.com -> 75.2.60.5`
- `www` CNAME: `www.afterhoursagenda.com -> afterhoursagenda.netlify.app`
- Google Workspace MX records were preserved during the cutover.
- Public resolver checks against `1.1.1.1`, `8.8.8.8`, and `9.9.9.9` returned Netlify records.
- Netlify HTTPS is active for apex and `www`.

## Verified Live State

- `npm run verify:netlify-site` passes for site `afterhoursagenda` / `275b4115-16bf-42fb-9b36-6bce9bb93608`.
- `npm run verify:commerce-readiness:netlify` passes; all required production env var names are present. Values were not printed.
- `npm run verify:netlify-live` passes for `https://afterhoursagenda.netlify.app/`.
- `LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live` passes.
- `https://afterhoursagenda.com/` returns HTTP 200 from `server: Netlify` with title `After Hours Agenda | Blacklight Grunge Streetwear`.
- `https://www.afterhoursagenda.com/` returns Netlify 301 to `https://afterhoursagenda.com/`.

## Source Layout

- App Router pages/routes: `app/`
- UI/components: `components/`
- Commerce integrations: `lib/square/`, `lib/printful/`, `lib/commerce/`
- Static assets: `public/`
- Build output (gitignored, do not hand-edit): `.next/`

## Secrets

- `.env*` files are gitignored and must not be inspected or committed.
- Real values belong in Netlify environment variables or the approved password manager.
- Commit only non-secret public configuration, such as `NEXT_PUBLIC_SITE_URL`.
- Name-only readiness checks are allowed; secret values must not be printed.

## Branches / Archives

- `main` = canonical source branch and production deploy branch.
- `feature/uiux-doctrine-commerce-hardening` = merged into `main` via PR #2, remote branch deleted after merge.
- `feature/retro-grunge-block-overhaul` = earlier redesign/restoration branch, retained remotely.
- `backup/consolidation-20260629` = preserved baseline from pre-overhaul consolidation.

## Commerce Integrations

- Square app used by handoff: `Claude`
- Square application ID: `sq0idp-g1rzr9cjPnZuw9gJTxD4bA`
- Square production location ID: `FGKRPYEXNV482`
- Square production webhook was created by handoff as `AHA Netlify Square Webhook`.
- Square webhook events reported by handoff:
  - `order.created`
  - `order.fulfillment.updated`
  - `order.updated`
  - `payment.created`
  - `payment.updated`
- Printful store reported by handoff: Square Online / Square store
- Printful store ID: `14298228`
- Printful token name reported by handoff: `AHA Netlify Commerce`
- Printful webhook events reported by handoff:
  - `order_created`
  - `order_updated`
  - `order_failed`
  - `order_canceled`
  - `shipment_sent`
  - `shipment_returned`
  - `shipment_out_of_stock`
  - `shipment_canceled`
  - `order_put_hold`
  - `order_remove_hold`

## Active Caveats

- No live checkout was run during cutover.
- No Square order was created during cutover.
- No Printful fulfillment was triggered during cutover.
- Webhook routes currently verify signatures and acknowledge/log events only; they do not create Printful orders or automate fulfillment.
- Netlify API still reports `prevent_non_git_prod_deploys: false`. Production deploys are Git-backed now, but non-Git production deploy blocking still needs confirmation if Netlify supports it for this site/account.
- Handoff says the Square production webhook was created with URL `https://afterhoursagenda.netlify.app/api/webhooks/square`; Netlify production currently reports non-secret `SQUARE_WEBHOOK_NOTIFICATION_URL=https://www.afterhoursagenda.com/api/webhooks/square`. Square signature verification requires the exact URL used by Square to match the env var. Confirm and align before relying on Square webhook processing.
- GitHub Action `Claude Code Review` failed on PR #2 due to Claude account billing lock per handoff, not due to a verified app build failure.

## Notes / History

- 2026-07-08 wrong-site incident: `https://afterhoursagenda.netlify.app/` served unrelated Pole Position IT content even though this repo had not been merged or deployed for the redesign.
- Root cause: the Netlify project was not Git-backed and accepted production deploy state outside the repo pipeline, so GitHub branch protections, PR review, and repo naming discipline could not protect the live `.netlify.app` URL.
- Restore completed: production deploy `6a4e3854c37b683eab4d38b8` published `main` merge commit `55d63fc` to `https://afterhoursagenda.netlify.app/` on 2026-07-08.
- Cutover completed after PR #2: domain, Netlify Git linking, production env names, Square webhook, Printful token/webhook, and HTTPS were configured; production deploys now point at commit `13c25e8`.
- Prevention rule: never deploy AHA by site name alone. Use the exact site id, run the target guard before deploy, run the live guard after deploy, and keep Git-backed deploys as the normal production path.
