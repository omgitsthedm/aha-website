# Create a product from the command line

One command creates a product in **Printful** (with its art) and **Square** (with price + sizes), then remaps the storefront catalog so it goes live.

## Usage
```bash
# 1. Write a spec (copy scripts/product.example.json)
# 2. Dry run — prints the plan, creates nothing:
npm run create-product -- --spec my-product.json
# 3. Create it for real:
npm run create-product -- --spec my-product.json --live
```
Tokens are read from env (`PRINTFUL_API_TOKEN`, `PRINTFUL_STORE_ID`, `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`). Locally, source them from Netlify:
```bash
export PRINTFUL_API_TOKEN=$(netlify env:get PRINTFUL_API_TOKEN)
export SQUARE_ACCESS_TOKEN=$(netlify env:get SQUARE_ACCESS_TOKEN)
export PRINTFUL_STORE_ID=$(netlify env:get PRINTFUL_STORE_ID)
npm run create-product -- --spec my-product.json --live
```

## Spec
```json
{
  "name": "Midnight Runners Tee",
  "retailPrice": 3800,                                  // cents
  "currency": "USD",
  "placements": [{ "placement": "front", "technique": "dtg", "fileUrl": "https://.../art.png" }],
  "variants": [{ "size": "S", "catalogVariantId": 4012 }, { "size": "M", "catalogVariantId": 4013 }]
}
```
- **catalogVariantId** — the Printful **catalog** variant id for that garment+size (from `GET /v2/catalog-products/{id}` or the Printful catalog). It picks the blank (e.g. Bella Canvas 3001, black, M).
- **fileUrl** — a publicly reachable print-ready PNG (host it under `public/` on the site, or any CDN).

## What happens
1. **Printful** — creates a sync product (v1 create API; v2 has no product creation) with your art on the chosen variants. This is the fulfillment source (its sync-variant id carries the art).
2. **Square** — creates a catalog item with one variation per size at your price. This is the money/checkout source.
3. **Remap** — re-runs `populate-maps.mjs`, joining the new Printful + Square records into `data/`.
4. **Live** — the storefront reads live Square, so the product appears within ~5 min (ISR). Commit + push `data/` to enable fulfillment mapping + validation:
   ```bash
   git add data/ && git commit -m "Add product: <name>" && git push
   ```

## Store type matters (important)
AHA's Printful store is **Square-integrated**, so Printful's product-creation API is **blocked**
("applies only to Manual Order / API platform stores"). For this store type the CLI:
- **Creates the product in Square** (item + sizes + price + art image) → it goes live/buyable on the storefront.
- **Cannot create the Printful product with art via API** — that's a Printful-dashboard step. To enable
  auto-fulfillment, open Printful → your store → the product → attach the art. Until then, orders for it
  route to `manual_review` (never a silent failure).
A Square-only product also isn't in `data/` (the manifest is built from Printful products), so it shows
from live Square without manifest enrichment until it's mapped in Printful.

## Notes
- The join is by normalized product **name** + **size**, so keep the Printful and Square names identical (the script does this).
- Live stock, PDP enrichment, and the purchasable gate all apply automatically once mapped.
- To pull the exact catalog variant ids for a garment: `GET https://api.printful.com/v2/catalog-products?category_id=...` then the product's variants.
