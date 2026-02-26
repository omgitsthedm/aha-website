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

// 2 non-Printful items: fetch their Square CDN image URLs
const NON_PRINTFUL_PRODUCTS = [
  { name: "Dots - Unisex Knitted Crewneck Sweater", filename: "Dots_-_Unisex_Knitted_Crewneck_Sweater.png" },
  { name: "Zebra - Unisex Knitted Cardigan", filename: "Zebra_-_Unisex_Knitted_Cardigan.png" },
];

async function processLocalPng(filename: string): Promise<void> {
  const filepath = path.join(PRINTFUL_DIR, filename);
  console.log(`Processing ${filename}...`);

  const inputBuffer = fs.readFileSync(filepath);
  const blob = new Blob([inputBuffer], { type: "image/png" });
  const resultBlob = await removeBackground(blob);
  const arrayBuffer = await resultBlob.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(arrayBuffer));

  console.log(`  done — ${filename}`);
}

async function fetchSquareImageUrl(productName: string): Promise<string | null> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    console.error("SQUARE_ACCESS_TOKEN not set. Load .env.local first.");
    return null;
  }

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

  const item = items.find(
    (i: any) => i.item_data?.name?.toLowerCase() === productName.toLowerCase()
  );
  if (!item) {
    console.error(`  Could not find Square product: ${productName}`);
    return null;
  }

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
  console.log(`  done — ${filename}`);
}

async function main() {
  console.log("=== Product Image Fix Script ===\n");

  // Process opaque local PNGs
  console.log("--- Processing opaque PNGs ---");
  for (const file of OPAQUE_PNGS) {
    try {
      await processLocalPng(file);
    } catch (err) {
      console.error(`  FAILED on ${file}:`, err);
    }
  }

  // Process non-Printful items
  console.log("\n--- Processing non-Printful items ---");
  for (const { name, filename } of NON_PRINTFUL_PRODUCTS) {
    try {
      await processNonPrintful(name, filename);
    } catch (err) {
      console.error(`  FAILED on ${name}:`, err);
    }
  }

  console.log("\n=== Done ===");
}

main();
