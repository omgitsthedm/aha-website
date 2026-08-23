# Product factory: design in, product out

## Current APLIIQ publisher

The legacy Printful factory below is retained for historical recovery only. It is not the APLIIQ publishing path, and the archived Square catalog must not be resurrected through it. The current path starts from one complete entry in `data/apliiq-capsule.json` plus the three required local product images. The publisher creates missing APLIIQ and Square records under explicit apply mode, then revalidates each result before continuing.

The safe final command is dry-run by default and requires one selected slug:

```bash
npm run publish:apliiq -- --slug <slug>
```

The dry run makes no provider calls and writes no product files. It fails closed on missing spec fields, story, positive integer-cent price, required `front`/`detail`/`art` images, and real size-guide rows. A missing APLIIQ design or Square mapping is shown as a planned apply step rather than treated as a source error. Existing provider records are still validated strictly: the design must carry production `APQ-...A1` SKUs and every size must ultimately have a Square variation.

After the provider credentials have been supplied through the approved environment wrapper, the explicit write mode is:

```bash
npm run publish:apliiq -- --slug <slug> --apply
```

Apply validates the local source, creates or skips the selected APLIIQ design, revalidates its A1 SKUs, and dry-validates that slug's landed cost, margin, and approval evidence before creating anything in Square. It then creates or resumes the Square item with deterministic content-based item/image keys. An existing mapped item is version-upserted to the spec's item name, regular product type, taxability, live presence, and each expected variation's mapped id/parent/name/SKU/fixed USD price/inventory/live presence. A fresh provider GET must prove every field before the manifest can be written; stale provider price or SKU never passes merely because the local ids exist.

Before the first Square item POST, the publisher atomically records a slug-scoped pending checkpoint under `data/.square-capsule-pending/` with the complete request fingerprint and the exact idempotency key. An unchanged recent retry reuses that key. Changed source while pending, malformed legacy checkpoints, and checkpoints outside the safe provider retention window fail closed and require catalog reconciliation rather than risk a duplicate. Only after a provider GET verifies the created item and every variation is the Square mapping atomically written to the capsule spec; the checkpoint is then removed.

Manifest re-publishing updates capsule-owned commerce and copy fields while retaining existing merchandising choices, including badges, priority, collections, gender, fit/care/production/shipping/returns notes, lifestyle/drop/launch metadata, and gallery images beyond the generated front/detail/art set. New rows receive the standard defaults. The publisher then writes the sellable-slug registry, runs `validate:all`, and verifies local route/feed eligibility. No publisher path deletes or archives a provider or local catalog record.

A new or redesigned mapped variant must not inherit approval from an older production identity. Its capsule product needs explicit reviewed evidence:

```json
"approvals": {
  "productionFingerprint": "<exact SHA-256 printed by the post-design preflight>",
  "mapping": { "status": "approved", "approvedAt": "2026-08-19" },
  "sample": { "status": "approved", "approvedAt": "2026-08-19" }
}
```

Both statuses must be `approved`, both dates must be real `YYYY-MM-DD` dates, and `productionFingerprint` must exactly equal the deterministic fingerprint printed by the failed post-design preflight. That fingerprint covers slug, blank product code/color/front location, design and artwork ids, artwork URL, service, print note, private-label subscription, size guide, and the sorted complete size/APQ-SKU set. Never copy an older fingerprint or have automation write approval evidence.

Because provider design and SKU ids do not exist at source time, source preflight may prepare the APLIIQ artwork/design first. The next preflight stops and prints the exact expected fingerprint; map, Square, manifest, sellable-slug, site, and feed activation remain blocked until humans add matching mapping and sample approval evidence. An already-mapped variant preserves its committed approval only when design ID, APQ SKU, artwork ID/URL, service, print note, private-label subscription, and size guide still match. Any mismatch requires fresh dated, identity-bound approvals; the map command never manufactures either status or fingerprint.

Optional `--commit` and `--push` are available only with `--apply`, on a completely clean non-main branch. `--push` also requires `--commit`; the command stages only the known generated product files, including `data/apliiq-capsule-designs.json`, and pushes the current branch to `origin`, never `main`. Normal release remains a reviewed pull request.

APLIIQ product intake also uses two review-only callbacks:

- `POST /api/integrations/apliiq/products/upsert` validates the provider payload and stores one `pending_review` draft per APQ SKU.
- `GET /api/integrations/apliiq/products/search` returns only products already represented by a committed, sale-ready `data/apliiq-map.json` mapping.

Both require the dedicated `APLIIQ_PRODUCT_CALLBACK_TOKEN`; neither accepts the API shared secret. Intake never writes `data/product-manifest.json`, `data/apliiq-map.json`, Square, or active storefront state. Human review must establish the APQ production SKU, decoration and private-label snapshots, HTTPS assets, supported regions, size guide, verified cost/margin timestamps, physical sample approval, and active Square variation before a line can become purchasable. `npm run validate:apliiq-map` and `npm run validate:all` fail closed on incomplete committed mappings.

## Legacy Printful publisher

The legacy tool below can create provider records, change catalog mappings, commit files, push `main`, and publish products. It is not the APLIIQ publisher above and must not be used for the current capsule. Start with a dry run. Use any live or push mode only when the current request explicitly authorizes those exact effects.

`npm run product:new` is the guided wrapper for garment presets and art hosting. Without `--live`, it prints a local preview and changes nothing. Its live mode creates provider records, commits, pushes `main`, and waits for production, so the same authorization boundary applies.

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

Always dry-run first by omitting `--live`. The preview prints variants, per-variant cost, price against the 35% floor, and placements without changing external systems.

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

## Techniques — one spec covers all of them

The factory derives technique, placement, and required product options from
the blank itself (`--spec` needs only the design + garment id):

| Technique | What happens | Proven |
|---|---|---|
| dtg / dtf | hosted art per placement, position in inches | 2026-07-13 |
| **embroidery** | plain PNG accepted; Printful **auto-digitizes** at order time (+$2.95 one-time per design) and auto-matches thread colors; layer options (e.g. `3d_puff`) pass through `spec.layerOptions` | 2026-07-14, draft order verified |
| cut-sew (totes) | `stitch_color` auto-filled (spec.stitchColor, default black) and sent on every order | 2026-07-14 |
| sublimation / uv / stickers | same placements shape; technique from the blank | 2026-07-14 |

`spec.story` (required for new products) is the authored truth of the design —
it flows to the manifest, the Square item (`description_html`), and the PDP,
replacing the generated template copy.

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

## Provider signals (v2 webhooks)

`catalog_price_changed` (global) and `catalog_stock_updated` (our blanks,
5-minute freshness) are registered to `/api/webhooks/printful`; events are
stored in `webhook_events` and audit-logged (`webhook:catalog_*`) for the
margin/liveness rails. After adding products with a NEW blank, re-register the
watched list (see scripts/register or the runbook in git history).

## Square heavy-lifters

- Items are created with `description_html` (the story) and a find-or-create
  **CATEGORY** per productType.
- Every paid order links a find-or-create **Square Customer** — the Square
  dashboard is the CRM (best-effort; never blocks payment).
- Old Printful **sync products can be DELETEd via API** even on this platform
  store (only create/edit is blocked). File Library entries have no delete
  endpoint — dashboard only, cosmetic.

## Safety rails

- Dry-run by default; `--live` is explicit.
- `--verify-draft` creates a Printful **draft** order and deletes it — a
  draft never charges and never ships; confirmation stays behind the
  production flags (`PRINTFUL_ALLOW_CONFIRM_ORDERS` + `PRINTFUL_LIVE_MODE`).
- The margin floor throws; it never silently reprices.
- Square items are created, never mutated destructively; deletions go through
  `/api/ops/catalog-rebuild` with an `inspect` pass first.
