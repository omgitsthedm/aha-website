# Database — After Hours Agenda

**Netlify DB (Neon Postgres).** Operational data only: orders, payments, fulfillments, shipments, webhook dedupe, audit, mappings, subscribers. **No card data, no API tokens.** Schema: `db/migrations/` (§14).

## Cost
Neon (Netlify DB) free tier is **free at AHA's volume** (~0.5 GB, autosuspends when idle). No cost to start.

## Provisioning (one-time — needs David / Netlify dashboard)
1. Netlify dashboard → site `afterhoursagenda` → **Extensions → Netlify DB** (or **Add-ons → Neon**) → provision. This creates a Neon Postgres and injects `DATABASE_URL` into the site env automatically.
2. Preview branches: Netlify DB creates a **branched DB per Deploy Preview** so previews never touch production data.
3. Pull the value locally for migrations/tests: `netlify env:get DATABASE_URL` (or copy from the Neon dashboard) into `.env.local`.

## Migrate
```bash
DATABASE_URL="postgres://…" npm run db:migrate   # applies db/migrations/*.sql in order (idempotent)
```

## Conventions
- Amounts are **minor units (cents)**, integers.
- `orders.payment_status` and `orders.fulfillment_status` are **separate** — never collapse them.
- `webhook_events` has a UNIQUE `(provider, dedupe_key)` — the idempotency backbone; every webhook is stored raw before processing and deduped here.
- Every status change writes an `audit_log` row.
