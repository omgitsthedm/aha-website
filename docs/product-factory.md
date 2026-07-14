# Product Factory — design in, live product out

Hand any agent a design and a garment choice; a purchasable product appears on
afterhoursagenda.com. No Printful dashboard, no manual Square edits.
Proven live 2026-07-14 (8-product resurrection run + the sheep rebuild).

## The one command

```bash
# New product from a spec
OPS_MAINTENANCE_KEY=... PRINTFUL_API_TOKEN=... \
  node scripts/product-factory.mjs --spec design.json [--live] [--verify-draft]

# Resurrect a manifest product that lost its Square item
OPS_MAINTENANCE_KEY=... PRINTFUL_API_TOKEN=... \
  node scripts/product-factory.mjs --resurrect <slug> --price 4600 [--live] \
  [--art <url>] [--price-map '{"15″×3.75″":1100}']
```

Always dry-run first (omit `--live`) — it prints variants, per-variant cost,
price vs the 35% floor, and placements without touching anything.

## Spec format (new products)

```json
{
  "name": "Midnight Runners Tee",
  "artUrl": "https://afterhoursagenda.com/printful-assets/Midnight_Runners.png",
  "garmentCatalogProductId": 786,
  "colors": ["Black", "Pepper"],
  "sizes": ["S", "M", "L", "XL", "2XL"],
  "placement": "front",
  "technique": "dtg",
  "position": { "width": 12, "height": 13.87, "top": 1.07, "left": 0 },
  "retailPrice": 4000,
  "productType": "tee",
  "collectionIds": ["tees"]
}
```

Omit `retailPrice` for auto pricing (35% floor + $1, whole dollar).
`--price-map` (resurrect) prices individual sizes; every size is checked
against its own 35% floor.

## What the factory does

1. **Art gates** — URL must be publicly reachable; PNG must be ≥1200px longest
   side (hard floor; 1800px+ recommended). Resurrections of sync-fulfilled
   products skip the size gate: printing uses the files already stored on the
   Printful sync product, the art only renders web mockups.
2. **Variant resolution** — Printful catalog variants for the blank
   (colors/sizes), or the manifest+sync product for resurrections.
3. **Cost + margin** — live Printful price API per variant; refuses any price
   under the 35% floor. Pricing above the floor is David's call.
4. **Mockups** — Printful mockup-tasks from the same art (falls back to the
   art itself as the Square image).
5. **Square item** — via the key-guarded production endpoint
   `/api/ops/catalog-create` (duplicate-name safe). The storefront hides
   imageless items, so images always ship with creation.
6. **Data files** — `data/product-manifest.json`, `data/square-map.json`,
   `data/printful-v2-map.json` rewritten; costs synced; `validate:all` run.
7. **Commit + deploy** — the data files are the storefront's fulfillment
   truth; the product is purchasable once the deploy is live.

## Fulfillment architecture (why nothing needs the Printful dashboard)

- **Catalog-source products** (factory-built): Square carries checkout; the
  printful-v2 map carries `printfulPlacements` (blank + hosted art + position
  in inches incl. `areaWidth/areaHeight`). Orders go out on the **v2 API**
  (`source: "catalog"`).
- **Sync-fulfilled products** (legacy + resurrections): the map carries
  `printfulSyncVariantId`; Printful's stored original print files are the
  print source. ⚠️ **v2 no longer accepts sync items** (since ~Jul 2026) —
  these orders go out on the **v1 API** (`sync_variant_id`). Mixed carts ship
  as one v1 order (catalog items converted to variant files, inches → 150dpi
  pixels). `lib/commerce/fulfillment-state.ts#buildStoreOrderRequest` decides
  per store batch; do not bypass it.
- **Product options**: cut-sew blanks (totes) require `stitch_color` on every
  order — stored as `printfulProductOptions` in the map and threaded
  automatically.

## Position rules (learned the hard way)

Printful enforces, at order time:
- the position box must fit inside the placement's print area;
- box ratio must match the file ratio within 2%.

`scripts/fix-rebuild-positions.mjs` recomputes positions from real print areas
(smallest mockup-style area = the safe one) and file ratios, and can
`--verify` each product with a v2 draft order (created, then deleted).
Run it after changing any print art.

## Related scripts

| Script | Purpose |
|---|---|
| `scripts/product-factory.mjs` | create / resurrect products |
| `scripts/fix-rebuild-positions.mjs` | recompute placements, draft-verify |
| `scripts/attach-rebuild-mockups.mjs` | mockups → existing Square items |
| `scripts/rebuild-sheep-products.mjs` | one-shot sheep rebuild (kept as a template) |
| `scripts/audit-provider-liveness.mjs` | `npm run audit:provider-liveness` — discontinued-blank sweep |

## Env

`PRINTFUL_API_TOKEN` (never in code), `PRINTFUL_STORE_ID` (default 14298228),
`OPS_MAINTENANCE_KEY` (gitignored `.env.local`; guards the production Square
endpoints), `SITE_URL` (default https://afterhoursagenda.com).

## Safety rails

- Dry-run by default; `--live` is explicit.
- `--verify-draft` creates a Printful **draft** order and deletes it — a
  draft never charges and never ships; confirmation stays behind the
  production flags (`PRINTFUL_ALLOW_CONFIRM_ORDERS` + `PRINTFUL_LIVE_MODE`).
- The margin floor throws; it never silently reprices.
- Square items are created, never mutated destructively; deletions go through
  `/api/ops/catalog-rebuild` with an `inspect` pass first.
