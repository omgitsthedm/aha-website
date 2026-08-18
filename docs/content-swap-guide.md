# Content swap guide — from demo to launch

The storefront is live on eight demo pieces and placeholder editorial imagery. Everything below is the exact path to replace them with the real designs, real photography and real product copy without touching code. Each step names the one file or system that owns the content.

## 1. A new product (or a redesigned one)

Owner: `data/apliiq-capsule.json` → APLIIQ → Square → `data/apliiq-map.json` → `data/product-manifest.json`.

1. **Art.** Drop the print file at `public/art/<slug>.png` — transparent PNG, ≥ 300 DPI at print size (10 in wide ≈ 3000 px), under 12 MB.
2. **Spec.** Add a product to `data/apliiq-capsule.json`: `slug`, `title`, `productCode` + `frontLocationId` (from APLIIQ `GET /Product`; NL3600 tee = `mens_Next-Level-Premium-Crew` / `4548`, IND4000 hood = `mens_independent-heavyweight-pullover-hoodie` / `6399`, IND3000 crew = `mens_Heavyweight-Crewneck-Sweatshirt` / `8455`), `retailPrice` in cents, `sizeGuideId`, `fabricDescription`, `printNote`, and the two hosted URLs (`artworkUrl`, `mockupUrl` — any public HTTPS; the storefront's own `/art/…` and `/products/…` paths work once deployed).
3. **Imagery.** `python3 scripts/imagery/render-product-imagery.py <slug>` renders the studio front, print detail and flat-art images into `public/products/<slug>/`; `python3 scripts/imagery/render-campaign-tiles.py` refreshes the campaign tiles. Real photography goes in the same folder with the same three names (`front.jpg`, `detail.jpg`, `art.jpg`) — or more, in gallery order.
4. **Square.** `node scripts/square-capsule.mjs create <slug>` makes the item, one variation per size, uploads the three images and writes the authored `description_html` from the spec's `story` field.
5. **APLIIQ.** `npm run apliiq:capsule -- create --apply --only <slug>` uploads the artwork and creates the design (SKUs must end in `A1`); `npm run apliiq:capsule -- map` rebuilds the sellable registry with live blank costs and margins.
6. **Manifest.** Add the product to `data/product-manifest.json` with the Square ids the create step printed (or run `node scripts/square-capsule.mjs manifest <slug>`), then `npm run generate:sellable-slugs`.
7. **Gate.** `npm run validate:all && npm test && npm run build` — the build refuses an `A0` SKU, a variant at a loss, or a missing image. Open a PR; production deploys on merge.

To retire a piece: remove it from `data/apliiq-capsule.json`, run `map`, set its manifest status to `draft`, regenerate slugs, and archive the Square item.

## 2. Photography and editorial imagery

Owner: `data/brand-imagery.json`. Every non-product image slot on the site is listed there with `src`, `alt`, `aspect`, `placeholder` and `source`.

- Replace the file at `src` (same aspect) or point `src` at a new file under `public/editorial/`, update `alt`, set `placeholder: false`.
- Slots: `hero` (home + lookbook cover, 16:9, subject on the right, dark left third), `maker` (home story + about, 16:9), `categories` (two tiles), `lookbook` (any number; `productSlug` links a frame to its piece), `signature` (the Black Sheep on-model pair), `archive` (history strip; keep the year and caption).
- Product photos from the shoot go to Square as the item images (front first) — see step 1.4 — not into this file.

## 3. Copy

- **Product stories** live in Square `description_html` (per item) — edit there or via `scripts/square-capsule.mjs copy <slug>`; the PDP, JSON-LD and previews read it.
- **Site copy** (home, about, manifesto, FAQ, shipping, returns) is in the page files under `app/`; windows and claims come from `lib/commerce/policies.ts` (production days, returns window, shipping sentence, country list). Change a number once, there.
- **Size guides**: `data/size-guides.json` — manufacturer garment specs per blank.

## 4. What is placeholder today

`data/brand-imagery.json` marks each: the rooftop and subway frames are AI-generated (plain black garments, no graphics), the on-model Black Sheep pair is a print-provider render of the previous run, the archive strip is real 2012–2014 brand material. Product imagery is studio renders of the actual print files. Swap in the shoot with §2; nothing else changes.
