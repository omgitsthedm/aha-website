# After Hours Agenda — website preview

This is an After Hours Agenda project. Custom-domain and client websites keep their own brands. The current audit branch adds a modern AHA editorial preview in **`site-preview/`**, using Astro 7.3.8 and Node 24.21.0. The existing Next.js 16.4.0 commerce application and root Netlify configuration remain preserved.

## Work on the preview

```bash
cd site-preview
npm ci
npm run check
npm run test:e2e
npm run dev
```

Use Node 24.21.0 (`site-preview/.nvmrc`). The dev server uses `127.0.0.1:48378`; built-site checks use `48379`. Browser tests use installed Google Chrome. Checks cover lint, strict types, build, artifact integrity, all routes, keyboard navigation, contact states, no-JavaScript content, narrow-screen reflow and accessibility.

## Identity and behavior

- AHA's current CSS tokens, Poppins 400/700/900, JetBrains Mono and canonical black-sheep mark are the brand authority. Historical design documents must be checked against current source.
- New orders remain paused. Lookbook captions distinguish campaign concepts, previous-run renders and the brand archive.
- Existing-order support remains visible. The contact form prepares a local email draft to `info@afterhoursagenda.com`; it does not send, store or subscribe anything.
- The preview has no commerce APIs, customer database, automated tracking lookup, newsletter backend, analytics or payment flow. Existing production integrations are unchanged.
- Source and asset provenance are recorded in `site-preview/claims.json` and the original `data/brand-imagery.json`.

## Deployment

- Exact Netlify site ID: `275b4115-16bf-42fb-9b36-6bce9bb93608` (`afterhoursagenda`).
- Active review alias: `https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app`. The alias retains an earlier technical name solely to supersede its active contents; the website is After Hours Agenda.
- Build `site-preview/dist`, stage outside the repo using `site-preview/scripts/stage.mjs`, and deploy only that static folder with empty functions and the explicit site ID.
- HTTP and HTML noindex protect against intended indexing, not public access. Do not promote this review artifact unchanged.
- The root `netlify.toml` remains the existing production configuration. The template in `site-preview/ops/production.netlify.toml` is inactive and approval-gated.
- `release.json` records source commit, artifact hash and exact site ID.

`AUDIT-REPORT.md` contains final verification and the preview receipt. `NEEDS-APPROVAL.md` records the breaking production migration and the business features that require separate approval. The preview is not authorization to replace the commerce runtime.

## Source structure

`site-preview/src/` holds current preview pages, shared data, layouts and styles. `site-preview/public/` contains AHA assets and local fonts. `site-preview/scripts/` builds and guards the artifact. `site-preview/tests/` contains meaningful artifact and installed-Chrome browser checks.

The preserved `app/`, `components/`, `lib/`, `data/`, `db/` and `ops/` directories remain the original AHA application. Its original lint, typecheck, tests, catalog validators and build commands remain available. Read `SOURCE_OF_TRUTH.md` before any release or provider work.
