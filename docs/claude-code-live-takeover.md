# Claude Code Live Takeover - After Hours Agenda

Last verified: 2026-07-08 21:57 MST by Codex.

## Current Mission

After Hours Agenda is live on the real custom domain. Claude Code should continue from the current `main` branch, not from old pre-cutover notes.

## Canonical Repo And Deploy

- Local repo: `/Users/davidmarsh/Code/LiFi NYC/Clients/After Hours Agenda/Website/aha-website`
- Visible repo path: `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website/aha-website`
- GitHub repo: `https://github.com/omgitsthedm/aha-website`
- Canonical branch: `main`
- Current commit: `13c25e83f696b19c7d9230ec4766900cc5485451`
- PR #2: `Prepare AHA Netlify commerce backend for cutover`, merged 2026-07-09 04:19:25 UTC.
- Netlify project: `afterhoursagenda`
- Netlify site ID: `275b4115-16bf-42fb-9b36-6bce9bb93608`
- Netlify admin: `https://app.netlify.com/projects/afterhoursagenda`
- Default URL: `https://afterhoursagenda.netlify.app`
- Primary live URL: `https://afterhoursagenda.com`
- `www` redirects to apex.

## Verified Commands

These passed during Codex takeover verification:

```bash
npm run verify:netlify-site
npm run verify:commerce-readiness:netlify
npm run verify:netlify-live
LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live
```

Current live title:

```text
After Hours Agenda | Blacklight Grunge Streetwear
```

## Netlify State

- Build command: `npm run build`
- Publish directory: `.next`
- Build image: `noble`
- Repo provider: GitHub
- Repo path: `omgitsthedm/aha-website`
- Repo branch: `main`
- Custom domain: `afterhoursagenda.com`
- `force_ssl`: true
- `prevent_non_git_prod_deploys`: false

Do not deploy by project name alone. Always verify exact site ID first.

## DNS State

- Authoritative DNS provider reported by handoff: Wix DNS
- Nameservers:
  - `ns8.wixdns.net`
  - `ns9.wixdns.net`
- Apex A: `75.2.60.5`
- `www` CNAME: `afterhoursagenda.netlify.app`
- Google Workspace MX records were preserved.

## Commerce State

Square:

- App used by handoff: `Claude`
- App ID: `sq0idp-g1rzr9cjPnZuw9gJTxD4bA`
- Production location ID: `FGKRPYEXNV482`
- Production env names are present in Netlify.
- Webhook name reported by handoff: `AHA Netlify Square Webhook`
- Events:
  - `order.created`
  - `order.fulfillment.updated`
  - `order.updated`
  - `payment.created`
  - `payment.updated`

Printful:

- Store: Square Online / Square store
- Store ID: `14298228`
- Token name reported by handoff: `AHA Netlify Commerce`
- Production env names are present in Netlify.
- Webhook events:
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

## Do Not Assume

- Do not assume live checkout works. It was not run.
- Do not assume Square webhooks are processing. URL alignment needs confirmation.
- Do not assume Printful fulfillment is automated. It is not.
- Do not inspect `.env` or `.env.local`.
- Do not print secret values.
- Do not create orders, payments, customer records, or fulfillment without a scoped safe path.

## Immediate Takeover Item

Confirm and align Square webhook URL/signature configuration.

Why: handoff says Square webhook URL is:

```text
https://afterhoursagenda.netlify.app/api/webhooks/square
```

Netlify production currently reports:

```text
SQUARE_WEBHOOK_NOTIFICATION_URL=https://www.afterhoursagenda.com/api/webhooks/square
```

The Square verification code signs/verifies against the exact URL. If the URL in Square and the env var differ, legitimate events will fail signature validation.

Resolution options:

1. Update Square webhook URL to `https://www.afterhoursagenda.com/api/webhooks/square`, or
2. Update Netlify `SQUARE_WEBHOOK_NOTIFICATION_URL` to the exact Square webhook URL.

This is a live configuration change. Ask David for plain-language scoped confirmation before changing either side.

## Next Work Queue

1. Confirm Square webhook URL alignment.
2. Create a sandbox checkout test plan.
3. Add durable event/order storage before any fulfillment automation.
4. Add idempotency for Square webhook events.
5. Map Square catalog/variation IDs to Printful variants.
6. Build Printful draft-order dry-run/manual-review flow.
7. Build shipment tracking/order status surface.
8. Run browser QA on mobile and desktop against `https://afterhoursagenda.com`.

## Approval Preference

David explicitly does not want rigid magic approval phrases going forward. For high-risk live changes, ask for clear scoped plain-language confirmation, restate the exact action, and proceed only after the confirmation is unambiguous. If generated `.ai/RULES.md` still conflicts, pause and clarify before taking the live action.

