# After Hours Agenda

Read `AGENTS.md`, `SOURCE_OF_TRUTH.md` and `NEEDS-APPROVAL.md`. This custom-domain clothing-brand project keeps its own identity. Only abstract projects use LFNYC branding.

The reviewed application is `site-preview/` (Astro 7.3.8, Node 24.21.0). Root Netlify configuration on the audit branch prepares the static migration. Original Next.js source and the canonical checkout remain preserved. The user approved moving the reviewed candidate toward production; GitHub still requires one independent PR approval and all nine named checks. Never bypass or weaken those controls, and never call a pending PR a completed deployment.

Run preview and production builds, artifact tests, installed-Chrome browser tests and the full new-app dependency audit. Use ports 48378/48379. The static site prepares email drafts and keeps orders paused; it does not run newsletter, order-query, payment or provider endpoints. Provider accounts/data, credentials, DNS and external sends stay outside this release.

After a successful main build, verify exact Git source, Netlify site/deploy, public release receipt, production headers/canonicals and all routes. New work is preview-first. `AUDIT-REPORT.md` is historical audit evidence; the current closeout records whether the release gate has cleared.
