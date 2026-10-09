# Current customer-service buildout — preview only

The October 9 static release below is complete. Its authorization does not publish this later customer-service buildout. The current task authorizes building and testing the new candidate in preview. No payment, supplier order, marketing send, DNS, billing or production-data mutation has occurred.

## Remaining launch inputs

1. Physical product approval: current garment/decoration/label/SKU, fit measurements, care/origin/label/QC evidence, final photographs, prices, availability and delivery/return policy. The current kit was inspected; it is still a review candidate. No August catalog was reopened. Fill `site-preview/src/data/launch-catalog.json` from approved evidence, then run `npm run check:launch` and the preserved catalog/provider validators. Never set the retired Printful gate true.
2. Provider health and operational activation: Netlify exposes the production key names but masks their values; source and local tests do not prove current Square/Apliiq/Resend health. Use the authenticated provider accounts to verify read-only location/catalog, approved provider SKU, webhook signing/URL, sender-domain and database binding. Capture a sandbox receipt before any sales activation. Enable `AHA_ORDER_SERVICES_ENABLED` and `AHA_AUTOMATIONS_ENABLED` only after signed callbacks, reconciliation, transactional messages and staffed support are verified. Commerce additionally requires `AHA_COMMERCE_ENABLED`, the existing Apliiq live flags and a valid approved manifest.
3. Production publication of this candidate remains a separate release. Source must pass both build modes, all required checks, exact function/archive review and installed-Chrome tests. GitHub main triggers the documented build; do not manually promote this noindex draft.

Prepared release commands, only after the new production instruction and exact PR/head are known:

```bash
gh pr checks <customer-service-pr> --repo omgitsthedm/aha-website --required
gh pr merge <customer-service-pr> --repo omgitsthedm/aha-website --squash --match-head-commit <reviewed-head> --subject 'feat: release AHA customer services' --body-file <reviewed-merge-body>
EXPECTED_COMMIT=<published-main-sha> node site-preview/scripts/verify-live.mjs
```

The documented Netlify Git build targets site `275b4115-16bf-42fb-9b36-6bce9bb93608`, builds production HTML and stages the unchanged migration history plus the additive migration. Never bypass a required independent review using the previous release's spent exception. Verify live receipt, eight functions, form registration and support behavior before marking publication complete. No new commercial terms or provider approval can be manufactured by a command.

---

# Approved production release — October 9, 2026

**Completed:** PRs #93 and #98 merged; deploy `6ac8bf631f5bb00008938cac` published source `7a23f9846a337de2ac85bb34014d5b3f983ca71c` on October 9 at 10:18:44 UTC. Live artifact and all route/browser checks passed. No approval is outstanding for this website release. The procedure below is the historical approved execution record, not pending work. New projects or commerce changes still require their own scope.


The owner explicitly instructed: “yup push it all live, document it and leave it the folder”. Production publication of the reviewed AHA rebuild and necessary release fixes is authorized. No further conversational approval is required for this release.

GitHub ruleset 20717491 already grants owner `omgitsthedm` (user 55168770) a pull-request-only exception. Use it for this release after all nine required checks pass. Do not change repository rules, create a fake review, or bypass failing checks. PR #93 merged with that permission; its first Netlify build failed before publication because the nested package config still refused production. The fix keeps both root and package Netlify contexts aligned. This supersedes earlier agent-written guidance treating the review exception as unavailable.

## Release and verification

Use GitHub main and exact Netlify site `275b4115-16bf-42fb-9b36-6bce9bb93608`, `https://afterhoursagenda.com`. Keep source changes on `audit/2026-10-09` and open a corrective PR with a title containing `[skip netlify]`; verify all nine required checks before merging. Pin the exact head. Use an explicit merge subject and body without Netlify skip markers for the final production build. No extra hosted preview is required for the configuration-only fix.

```bash
gh pr checks <corrective-pr> --repo omgitsthedm/aha-website --required
gh pr merge <corrective-pr> --repo omgitsthedm/aha-website --squash --admin --match-head-commit <verified-head> --subject 'fix: activate approved AHA production configuration' --body-file <reviewed-merge-body>
EXPECTED_COMMIT=<published-main-sha> node site-preview/scripts/verify-live.mjs
```

Before merging, run both modes' lint/type/build/artifact tests, local installed-Chrome browser checks, and an offline Netlify production build using the selected nested configuration. After publication, verify the exact Git source, Netlify deploy, production release digest, every public file, all 16 routes, headers, indexing, ownership files, and desktop/mobile browser checks. Record the successful deploy and known credit effect in the Desktop project folder.

## Boundaries preserved

New orders remain paused. Contact prepares an unsent local email. Automated newsletter signup, customer order lookup, operational/provider callbacks, analytics and payment runtime are excluded as disclosed. Provider/customer data, accounts, credentials and historical source remain unchanged. No DNS, billing, payment, fulfillment, deletion, campaign or social posting is authorized. Future commerce restoration needs its own scope. New development returns to preview-first after this release.
