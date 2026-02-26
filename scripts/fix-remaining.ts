import { removeBackground } from "@imgly/background-removal-node";
import fs from "fs";
import path from "path";

const PRINTFUL_DIR = path.join(process.cwd(), "public", "printful-assets");

async function processLocal(filename: string): Promise<void> {
  const filepath = path.join(PRINTFUL_DIR, filename);
  console.log("Processing " + filename + "...");
  const inputBuffer = fs.readFileSync(filepath);
  const blob = new Blob([inputBuffer], { type: "image/png" });
  const resultBlob = await removeBackground(blob);
  const arrayBuffer = await resultBlob.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(arrayBuffer));
  console.log("  done — " + filename);
}

async function processRemote(
  productName: string,
  filename: string
): Promise<void> {
  console.log("Fetching Square image for " + productName + "...");
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    console.error("  SQUARE_ACCESS_TOKEN not set");
    return;
  }

  const res = await fetch("https://connect.squareup.com/v2/catalog/search", {
    method: "POST",
    headers: {
      "Square-Version": "2024-01-18",
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      object_types: ["ITEM"],
      query: { text_query: { keywords: [productName] } },
      include_related_objects: true,
    }),
  });

  const data = await res.json();
  const items = data.objects || [];
  const related = data.related_objects || [];

  const item = items.find(
    (i: any) =>
      i.item_data?.name?.toLowerCase() === productName.toLowerCase()
  );
  if (!item) {
    console.error("  Not found: " + productName);
    return;
  }

  const imageIds = item.item_data?.image_ids || [];
  let imageUrl = "";
  for (const id of imageIds) {
    const imgObj = related.find(
      (r: any) => r.id === id && r.type === "IMAGE"
    );
    if (imgObj?.image_data?.url) {
      imageUrl = imgObj.image_data.url;
      break;
    }
  }
  if (!imageUrl) {
    console.error("  No image for: " + productName);
    return;
  }

  console.log("  Downloading...");
  const imgRes = await fetch(imageUrl);
  const ab = await imgRes.arrayBuffer();
  const blob = new Blob([Buffer.from(ab)], { type: "image/jpeg" });

  console.log("  Removing background...");
  const resultBlob = await removeBackground(blob);
  const resultBuf = await resultBlob.arrayBuffer();
  fs.writeFileSync(path.join(PRINTFUL_DIR, filename), Buffer.from(resultBuf));
  console.log("  done — " + filename);
}

async function main() {
  // Non-Printful items from Square CDN (correct full product names)
  await processRemote(
    "Dots - Unisex Knitted Crewneck Sweater",
    "Dots_-_Unisex_Knitted_Crewneck_Sweater.png"
  );
  await processRemote(
    "Zebra - Unisex Knitted Cardigan",
    "Zebra_-_Unisex_Knitted_Cardigan.png"
  );
}

main();
