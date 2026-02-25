import { squareRequest } from "./client";
import type { Product, Collection } from "@/lib/utils/types";
import { mapSquareItemToProduct, mapSquareCategoryToCollection } from "@/lib/utils/mappers";

interface SquareCatalogResponse {
  objects?: any[];
  cursor?: string;
  related_objects?: any[];
}

interface SquareSearchResponse {
  objects?: any[];
  cursor?: string;
  related_objects?: any[];
}

export async function getAllProducts(): Promise<Product[]> {
  let allItems: any[] = [];
  let allRelated: any[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      object_types: ["ITEM"],
      include_related_objects: true,
      limit: 100,
    };
    if (cursor) body.cursor = cursor;

    const res = await squareRequest<SquareSearchResponse>(
      "/catalog/search",
      { method: "POST", body }
    );

    if (res.objects) allItems.push(...res.objects);
    if (res.related_objects) allRelated.push(...res.related_objects);
    cursor = res.cursor;
  } while (cursor);

  // Build image map from related objects
  const imageMap = new Map<string, string>();
  for (const obj of allRelated) {
    if (obj.type === "IMAGE" && obj.image_data?.url) {
      imageMap.set(obj.id, obj.image_data.url);
    }
  }

  return allItems
    .filter((item) => !item.is_deleted)
    .map((item) => mapSquareItemToProduct(item, imageMap));
}

export async function getProduct(slug: string): Promise<Product | null> {
  const products = await getAllProducts();
  return products.find((p) => p.slug === slug) || null;
}

export async function getAllCollections(): Promise<Collection[]> {
  const res = await squareRequest<SquareCatalogResponse>(
    "/catalog/search",
    {
      method: "POST",
      body: {
        object_types: ["CATEGORY"],
        include_related_objects: true,
      },
    }
  );

  if (!res.objects) return [];

  // Collection IDs and their metadata
  const collectionMeta: Record<string, { accent: string; description: string }> = {
    "57JPU5ZDHXGWVPRQQZMWVR5Q": { accent: "mint", description: "Stand apart. Think different. Be the one they talk about." },
    "JPSOS6BFOQPITXEJFYJWYIXZ": { accent: "gold", description: "No crowns. No thrones. Just people who lead themselves." },
    "SZ6M4QZCTTSPNRKY5VS3JDAW": { accent: "blue", description: "For the hours between midnight and dawn." },
    "OCWUVMJQMVGJZ6FT62K5HVP4": { accent: "gold", description: "The city that made us. Every piece carries its energy." },
    "BRNXSU4IF5U3AWAYYYP3TTHU": { accent: "sunrise", description: "Wear your optimism. Tomorrow is unwritten." },
    "ARX3DXVEX6CJOIBNNYKNX6MU": { accent: "sunrise", description: "The glass is always full. Hope is a strategy." },
    "QGLIV54AJSOYXZOX5IBWQVPM": { accent: "gold", description: "The building blocks. Clean cuts, premium feel." },
    "FAIJ7SE5DJP25N26ND3L76SU": { accent: "mint", description: "Fresh off the press. The latest from After Hours." },
  };

  return res.objects
    .filter((obj: any) => !obj.is_deleted && collectionMeta[obj.id])
    .map((obj: any) => mapSquareCategoryToCollection(obj, collectionMeta[obj.id]));
}

export async function getProductsByCollection(collectionId: string): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter((p) => p.collectionIds.includes(collectionId));
}
