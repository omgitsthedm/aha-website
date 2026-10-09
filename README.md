# Little Fight NYC preview / preserved AHA production

The `audit/2026-10-09` branch adds a complete LFNYC service website in **`lfnyc/`**. It is a static Astro 7.3.8 application on Node 24.21.0. The repository-root Next.js **16.4.0** commerce application and root Netlify configuration remain the existing After Hours Agenda production source. Do not deploy the root as the LFNYC preview.

## Run the new site

```bash
cd lfnyc
npm ci
npm run check
npm run test:e2e
npm run dev
```

Use Node 24.21.0 (`lfnyc/.nvmrc`). Development binds to `127.0.0.1:48378`; the built static server uses `48379`. Browser tests use installed Google Chrome, never bundled Chromium. `npm run check` runs lint, strict types, static build and unit/artifact checks. `npm run test:e2e` covers desktop/mobile pages, axe, keyboard menu, contact states, no-JavaScript content, 320px reflow and legacy-route 404s.

## Preview contract

- Review URL: https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app
- Exact site ID: `275b4115-16bf-42fb-9b36-6bce9bb93608`.
- Publish only `lfnyc/dist` from a separate static staging directory; no build plugins, functions, migrations or inherited AHA environment are needed.
- The site prepares email drafts. It sends nothing and stores no leads. Phone and email links work without JavaScript.
- HTTP and HTML carry `noindex`. This public preview is not password protected.
- Root `netlify.toml` remains AHA production. `lfnyc/ops/production.netlify.toml` is an inactive approval-gated migration template.
- `release.json` binds the artifact to a source commit and digest. No source documents or private evidence are published.

Read `AUDIT-REPORT.md` for verified results and `NEEDS-APPROVAL.md` for the prepared production migration. Do not merge this branch to main or change the active build target without explicit production approval.

## Structure

```text
lfnyc/src/          New pages, layouts, content, styles and contact enhancement
lfnyc/public/       Cleared brand assets, local fonts and published-work captures
lfnyc/scripts/      Build guards, static headers, metadata and local server
lfnyc/tests/        Unit/artifact and installed-Chrome browser checks
lfnyc/ops/          Inactive production migration template
app/, lib/, db/    Preserved AHA source and operational data contracts
```

## Preserved application

Legacy root commands remain `npm run lint`, `npm run typecheck`, `npm test`, `npm run validate:all`, and `npm run build`. Its dependencies and provider contracts are separate from the new preview. Historical commerce and catalog records are retained for recovery, not shipped by the static preview. Read `SOURCE_OF_TRUTH.md` before any live-system work.
