# After Hours Agenda

**Release completed October 9, 2026:** source `7a23f9846a337de2ac85bb34014d5b3f983ca71c`, production deploy `6ac8bf631f5bb00008938cac`. All 16 live routes and nine browser suites pass. The one-release authorization is spent; new work is preview-first.


Read `AGENTS.md`, `SOURCE_OF_TRUTH.md` and `NEEDS-APPROVAL.md`. This custom-domain clothing-brand project keeps its own identity. Only abstract projects use LFNYC branding.

The reviewed application is `site-preview/` (Astro 7.3.8, Node 24.21.0). Root Netlify configuration on the audit branch prepares the static migration. Original Next.js source and the canonical checkout remain preserved. The owner explicitly approved production on October 9, 2026. For this release only, use the existing named-owner PR exception after all nine required checks pass; do not alter repository rules or fabricate a review. Root netlify.toml selects site-preview, whose nested netlify.toml controls the actual build contexts. Keep them aligned and never call a pending build a completed deployment.

Run preview and production builds, artifact tests, installed-Chrome browser tests and the full new-app dependency audit. Use ports 48378/48379. The published static release still prepares email drafts. The newer customer-service candidate adds forms, guest tracking, shopping, guarded provider services and optional measurement in preview. Read `COMMERCE-BUILDOUT-2026-10-09.md`. Preview actions never access customer records, charge, fulfill or send messages. The approved launch manifest remains empty. No new production authorization is recorded.

After a successful main build, verify exact Git source, Netlify site/deploy, public release receipt, production headers/canonicals and all routes. New work is preview-first. `AUDIT-REPORT.md` is historical audit evidence; the current closeout records whether the release gate has cleared.
