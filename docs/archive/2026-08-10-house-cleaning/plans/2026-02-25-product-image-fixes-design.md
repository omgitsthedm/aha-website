# Product Image Fixes Design

## Problem

Three remaining product image issues on the AHA site after the Printful PNG swap:

1. **6 opaque PNGs** have white backgrounds baked in (beanie, can cooler, tote bag, stickers, socks, pin buttons)
2. **2 non-Printful items** (Dots Sweater, Zebra Cardigan) have no local PNG — only Square CDN JPEGs with white backgrounds
3. **White products on dark backgrounds** (white tees, bone sweatshirts) have transparent backgrounds but visually disappear against `bg-surface` (#1A1918)

## Approach: One-time preprocessing + CSS fixes

### 1. Background removal script

New file `scripts/fix-opaque-images.ts` using `@imgly/background-removal-node`:

- Processes 6 opaque PNGs in `public/printful-assets/` — removes white backgrounds, overwrites in place
- Downloads 2 non-Printful product images from Square CDN, removes backgrounds, saves as PNGs in `public/printful-assets/`
- Run once locally, commit results — zero build-time cost

**Opaque files:**
- `AHA_Cuffed_Beanie.png`
- `Black_Sheep_Can_Cooler.png`
- `Books_and_Regrets_Tote_Bag.png`
- `Branded_Black_Bubble-free_Stickers.png`
- `Pink_Sheep_Comfy_Socks.png`
- `Set___2__of_pin_buttons.png`

**Non-Printful files to create:**
- `Dots_Sweater.png` (from Square CDN JPEG)
- `Zebra_Cardigan.png` (from Square CDN JPEG)

### 2. CSS: object-contain for Printful PNGs

All product images currently use `object-cover` which crops to fill `aspect-[3/4]` containers. For Printful PNGs (transparent backgrounds), switch to `object-contain` so products float naturally.

**Files to modify:**
- `components/shop/ShopContent.tsx`
- `components/product/ProductDetail.tsx`
- `components/homepage/LatestDrop.tsx`
- `components/homepage/MostWanted.tsx`
- `components/cart/CartDrawer.tsx`

Detection: check if image path starts with `/printful-assets/`.

### 3. CSS: drop shadow for white products

Add `drop-shadow(0 4px 12px rgba(255,255,255,0.15))` filter on Printful PNG images. Gives white/light products definition against dark backgrounds without adding visible card elements.

Applied via conditional className on the Next.js `<Image>` component.

### 4. Name matching

Non-Printful filenames follow existing convention — no changes needed to `printful-images.ts`:
- "Dots Sweater" normalizes to `dots sweater`, matches `Dots_Sweater.png`
- "Zebra Cardigan" normalizes to `zebra cardigan`, matches `Zebra_Cardigan.png`
