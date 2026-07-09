# Database — After Hours Agenda

**Netlify DB (Neon Postgres), managed via Drizzle.** Operational data only: orders, payments, fulfillments, shipments, webhook dedupe, audit, mappings, subscribers. **No card data, no API tokens.** (§14)

- **Schema:** `db/schema.ts` (Drizzle) — the single source of truth.
- **Migrations:** `netlify/database/migrations/` — Netlify **auto-applies pending migrations on every deploy**.
- **Connection:** Netlify injects `NETLIFY_DATABASE_URL` at runtime (`lib/db/client.ts`). `DATABASE_URL` is a local/CI fallback.

## Provisioned
Neon DB is provisioned (`netlify database init`). Free tier — free at AHA's volume. Deploy Previews get branched DBs so previews never touch production data.

## Change the schema
1. Edit `db/schema.ts`.
2. `npm run db:generate` — Drizzle writes a new migration to `netlify/database/migrations/`.
3. Commit it. On deploy, Netlify applies it. To apply immediately to the linked DB: `npm run db:apply`.

## Inspect
```bash
netlify database status
netlify database connect --query "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

## Conventions
- Amounts are **minor units (cents)**, integers.
- `orders.payment_status` and `orders.fulfillment_status` are **separate** — never collapse them.
- `webhook_events` has UNIQUE `(provider, dedupe_key)` — the idempotency backbone; store raw payload before processing, dedupe here.
- Every status change writes an `audit_log` row.
