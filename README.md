# After Hours Agenda storefront

After Hours Agenda is a live New York streetwear storefront at `https://afterhoursagenda.com`. The application uses Next.js 15, TypeScript, Netlify, Square, Printful, Netlify Database, and Resend.

## Start here

Agents read `AGENTS.md` and `SOURCE_OF_TRUTH.md`. Open detailed design, product, commerce, or operations documents only when the task needs them.

## Local commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run validate:all
npm run build
```

## Read-only production checks

```bash
npm run verify:netlify-site
LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live
npm run verify:commerce-readiness:netlify
```

These checks do not authorize a deploy, live checkout, provider write, order, fulfillment, email, or production-data mutation.

## Repository layout

```text
app/                Next.js routes and application programming interface routes
components/         Storefront and shared interface components
lib/                Commerce, provider, data, database, and shared logic
data/               Product manifest and provider mappings
scripts/            Validation and product operations
ops/                Exact-site and commerce-readiness guards
db/                 Database schema and migrations
docs/               Current task-specific references and an on-demand historical archive
.github/workflows/  Continuous integration and release checks
```

Use `docs/README.md` to select one current reference. Historical handoffs, audits, plans, and superseded operations guides are archived and excluded from normal searches.
