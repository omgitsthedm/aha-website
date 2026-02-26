# Product Image Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all remaining product image issues: remove backgrounds from 6 opaque PNGs, create PNGs for 2 non-Printful items, and add CSS treatment so white products don't disappear on dark backgrounds.

**Architecture:** One-time preprocessing script using `@imgly/background-removal-node` to fix image assets, then CSS changes across 5 components to switch from `object-cover` to `object-contain` for Printful PNGs and add a subtle drop shadow for product definition.

**Tech Stack:** `@imgly/background-removal-node`, Next.js Image component, Tailwind CSS, Square Catalog API (for fetching non-Printful product image URLs)

---

### Task 1: Install background removal dependency

**Files:**
- Modify: `package.json`

**Step 1: Install `@imgly/background-removal-node` as a dev dependency**

Run:
```bash
cd "/Users/davidmarsh/After Hours Agenda/aha-website" && npm install --save-dev @imgly/background-removal-node
```

Expected: Package added to devDependencies in package.json

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @imgly/background-removal-node for image preprocessing"
```

---

### Task 2: Create the background removal script

**Files:**
- Create: `scripts/fix-opaque-images.ts`

**Step 1: Write the script**

```typescript
import { removeBackground } from "@imgly/background-removal-node";
import fs from "fs";
import path from "path";

const PRINTFUL_DIR = path.join(process.cwd(), "public", "printful-assets");

// 6 opaque PNGs that need background removal
const OPAQUE_PNGS = [
  "AHA_Cuffed_Beanie.png",
  "Black_Sheep_Can_Cooler.png",
  "Books_and_Regrets_Tote_Bag.png",
  "Branded_Black_Bubble-free_Stickers.png",
  "Pink_Sheep_Comfy_Socks.png",
  "Set___2__of_pin_buttons.png",
];

// 2 non-Printful items: we need to fetch their Square CDN image URLs
const NON_PRINTFUL_PRODUCTS = [
  { name: "Dots Sweater", filename: "Dots_Sweater.png" },
  { name: "Zebra Cardigan", filename: "Zebra_Cardigan.png" },
];

async function processLocalPng(filename: string): Promise<void> {
  const filepath = path.join(PRINTFUL_DIR, filename);
  console.log(`Processing ${filename}...`);

  const inputBuffer = fs.readFileSync(filepath);
  const blob = new Blob([inputBuffer], { type: "image/png" });
  const resultBlob = await removeBackground(blob);
  const arrayBuffer = await resultBlob.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(arrayBuffer));

  console.log(`  ✓ ${filename} — background removed`);
}

async function fetchSquareImageUrl(productName: string): Promise<string | null> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    console.error("SQUARE_ACCESS_TOKEN not set");
    return null;
  }

  // Search for the product by name
  const res = await fetch("https://connect.squareup.com/v2/catalog/search", {
    method: "POST",
    headers: {
      "Square-Version": "2024-01-18",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      object_types: ["ITEM"],
      query: {
        text_query: { keywords: [productName] },
      },
      include_related_objects: true,
    }),
  });

  const data = await res.json();
  const items = data.objects || [];
  const related = data.related_objects || [];

  // Find the item matching the name
  const item = items.find(
    (i: any) => i.item_data?.name?.toLowerCase() === productName.toLowerCase()
  );
  if (!item) {
    console.error(`  Could not find Square product: ${productName}`);
    return null;
  }

  // Get first image URL from related objects
  const imageIds = item.item_data?.image_ids || [];
  for (const id of imageIds) {
    const imgObj = related.find((r: any) => r.id === id && r.type === "IMAGE");
    if (imgObj?.image_data?.url) {
      return imgObj.image_data.url;
    }
  }

  console.error(`  No image found for: ${productName}`);
  return null;
}

async function processNonPrintful(
  productName: string,
  filename: string
): Promise<void> {
  console.log(`Fetching Square image for "${productName}"...`);
  const imageUrl = await fetchSquareImageUrl(productName);
  if (!imageUrl) return;

  console.log(`  Downloading from Square CDN...`);
  const res = await fetch(imageUrl);
  const arrayBuffer = await res.arrayBuffer();
  const blob = new Blob([Buffer.from(arrayBuffer)], { type: "image/jpeg" });

  console.log(`  Removing background...`);
  const resultBlob = await removeBackground(blob);
  const resultBuffer = await resultBlob.arrayBuffer();

  const outPath = path.join(PRINTFUL_DIR, filename);
  fs.writeFileSync(outPath, Buffer.from(resultBuffer));
  console.log(`  ✓ ${filename} — created with transparent background`);
}

async function main() {
  console.log("=== Product Image Fix Script ===\n");

  // Process opaque local PNGs
  console.log("--- Processing opaque PNGs ---");
  for (const file of OPAQUE_PNGS) {
    try {
      await processLocalPng(file);
    } catch (err) {
      console.error(`  ✗ Failed on ${file}:`, err);
    }
  }

  // Process non-Printful items
  console.log("\n--- Processing non-Printful items ---");
  for (const { name, filename } of NON_PRINTFUL_PRODUCTS) {
    try {
      await processNonPrintful(name, filename);
    } catch (err) {
      console.error(`  ✗ Failed on ${name}:`, err);
    }
  }

  console.log("\n=== Done ===");
}

main();
```

**Step 2: Commit the script**

```bash
git add scripts/fix-opaque-images.ts
git commit -m "feat: add background removal script for opaque product images"
```

---

### Task 3: Run the background removal script

**Step 1: Run the script**

Run:
```bash
cd "/Users/davidmarsh/After Hours Agenda/aha-website" && npx tsx scripts/fix-opaque-images.ts
```

Expected: 8 images processed — 6 local PNGs overwritten, 2 new PNGs created.
This may take 2-5 minutes depending on the AI model download.

**Step 2: Verify the outputs are transparent**

Run:
```bash
cd "/Users/davidmarsh/After Hours Agenda/aha-website" && for f in AHA_Cuffed_Beanie.png Black_Sheep_Can_Cooler.png Books_and_Regrets_Tote_Bag.png Branded_Black_Bubble-free_Stickers.png Pink_Sheep_Comfy_Socks.png Set___2__of_pin_buttons.png Dots_Sweater.png Zebra_Cardigan.png; do echo -n "$f: "; identify -format "%[opaque]" "public/printful-assets/$f" 2>/dev/null || echo "not found"; done
```

Expected: All 8 files should report `False` (not opaque).

**Step 3: Commit the processed images**

```bash
git add public/printful-assets/AHA_Cuffed_Beanie.png public/printful-assets/Black_Sheep_Can_Cooler.png public/printful-assets/Books_and_Regrets_Tote_Bag.png public/printful-assets/Branded_Black_Bubble-free_Stickers.png public/printful-assets/Pink_Sheep_Comfy_Socks.png public/printful-assets/Set___2__of_pin_buttons.png public/printful-assets/Dots_Sweater.png public/printful-assets/Zebra_Cardigan.png
git commit -m "fix: remove backgrounds from 6 opaque PNGs and add 2 non-Printful product images"
```

---

### Task 4: Create isPrintfulImage utility

**Files:**
- Create: `lib/utils/image-helpers.ts`

**Step 1: Write the utility**

```typescript
/**
 * Check if an image path is a local Printful PNG.
 * Used to conditionally apply object-contain and drop shadow styles.
 */
export function isPrintfulImage(src: string): boolean {
  return src.startsWith("/printful-assets/");
}
```

**Step 2: Commit**

```bash
git add lib/utils/image-helpers.ts
git commit -m "feat: add isPrintfulImage utility for conditional image styling"
```

---

### Task 5: Update ShopContent.tsx — object-contain + drop shadow

**Files:**
- Modify: `components/shop/ShopContent.tsx:1` (add import)
- Modify: `components/shop/ShopContent.tsx:180-184` (Image className)

**Step 1: Add import at top of file**

After the existing imports (line 9), add:
```typescript
import { isPrintfulImage } from "@/lib/utils/image-helpers";
```

**Step 2: Update the Image component className (line 184)**

Change:
```typescript
className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
```

To:
```typescript
className={`${
  isPrintfulImage(product.images[0]) ? "object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]" : "object-cover"
} transition-transform duration-700 group-hover:scale-[1.03]`}
```

**Step 3: Build to verify no errors**

Run: `cd "/Users/davidmarsh/After Hours Agenda/aha-website" && npm run build 2>&1 | tail -5`

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add components/shop/ShopContent.tsx
git commit -m "fix: use object-contain with drop shadow for Printful images in shop grid"
```

---

### Task 6: Update ProductDetail.tsx — object-contain + drop shadow

**Files:**
- Modify: `components/product/ProductDetail.tsx:1` (add import)
- Modify: `components/product/ProductDetail.tsx:120` (hero image)
- Modify: `components/product/ProductDetail.tsx:153` (thumbnails)
- Modify: `components/product/ProductDetail.tsx:308` (related products)

**Step 1: Add import after existing imports (line 11)**

```typescript
import { isPrintfulImage } from "@/lib/utils/image-helpers";
```

**Step 2: Update hero image className (line 120)**

Change:
```typescript
className="object-cover transition-all duration-500 ease-out"
```

To:
```typescript
className={`${
  isPrintfulImage(product.images[activeImage]) ? "object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]" : "object-cover"
} transition-all duration-500 ease-out`}
```

**Step 3: Update thumbnail image className (line 153)**

Change:
```typescript
className="object-cover"
```

To:
```typescript
className={isPrintfulImage(img) ? "object-contain" : "object-cover"}
```

Note: No drop shadow on thumbnails — they're too small.

**Step 4: Update related products image className (line 308)**

Change:
```typescript
className="object-cover transition-transform duration-700 group-hover:scale-105"
```

To:
```typescript
className={`${
  isPrintfulImage(p.images[0]) ? "object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]" : "object-cover"
} transition-transform duration-700 group-hover:scale-105`}
```

**Step 5: Commit**

```bash
git add components/product/ProductDetail.tsx
git commit -m "fix: use object-contain with drop shadow for Printful images in product detail"
```

---

### Task 7: Update LatestDrop.tsx — object-contain + drop shadow

**Files:**
- Modify: `components/homepage/LatestDrop.tsx:1` (add import)
- Modify: `components/homepage/LatestDrop.tsx:139` (Image className)

**Step 1: Add import after existing imports (line 7)**

```typescript
import { isPrintfulImage } from "@/lib/utils/image-helpers";
```

**Step 2: Update Image className (line 139)**

Change:
```typescript
className="object-cover"
```

To:
```typescript
className={isPrintfulImage(product.images[0]) ? "object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]" : "object-cover"}
```

**Step 3: Commit**

```bash
git add components/homepage/LatestDrop.tsx
git commit -m "fix: use object-contain with drop shadow for Printful images in LatestDrop"
```

---

### Task 8: Update MostWanted.tsx — object-contain + drop shadow

**Files:**
- Modify: `components/homepage/MostWanted.tsx:1` (add import)
- Modify: `components/homepage/MostWanted.tsx:118` (Image className)

**Step 1: Add import after existing imports (line 7)**

```typescript
import { isPrintfulImage } from "@/lib/utils/image-helpers";
```

**Step 2: Update Image className (line 118)**

Change:
```typescript
className="object-cover"
```

To:
```typescript
className={isPrintfulImage(product.images[0]) ? "object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]" : "object-cover"}
```

**Step 3: Commit**

```bash
git add components/homepage/MostWanted.tsx
git commit -m "fix: use object-contain with drop shadow for Printful images in MostWanted"
```

---

### Task 9: Update CartDrawer.tsx — object-contain + drop shadow

**Files:**
- Modify: `components/cart/CartDrawer.tsx:1` (add import)
- Modify: `components/cart/CartDrawer.tsx:77` (Image className)

**Step 1: Add import after existing imports (line 6)**

```typescript
import { isPrintfulImage } from "@/lib/utils/image-helpers";
```

**Step 2: Update Image className (line 77)**

Change:
```typescript
className="object-cover"
```

To:
```typescript
className={isPrintfulImage(item.image) ? "object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]" : "object-cover"}
```

**Step 3: Commit**

```bash
git add components/cart/CartDrawer.tsx
git commit -m "fix: use object-contain with drop shadow for Printful images in cart drawer"
```

---

### Task 10: Final build, verify, and deploy

**Step 1: Full build**

Run:
```bash
cd "/Users/davidmarsh/After Hours Agenda/aha-website" && npm run build
```

Expected: Build succeeds with all pages generated.

**Step 2: Push to remote**

```bash
git push
```

Expected: Netlify auto-deploys from push.

**Step 3: Visual verification**

Check the live site for:
- AHA Cuffed Beanie — transparent background, floating on dark surface
- Black Sheep Can Cooler — transparent background
- Dots Sweater and Zebra Cardigan — now have local transparent PNGs
- White t-shirts — visible drop shadow gives definition against dark background
- All products using `object-contain` — products are fully visible, not cropped
