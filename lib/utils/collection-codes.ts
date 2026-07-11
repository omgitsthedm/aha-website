export interface CollectionCode {
  slug: string;
  name: string;
  abbr: string;
}

export const COLLECTION_CODES: Record<string, CollectionCode> = {
  "black-sheep": { slug: "black-sheep", name: "Black Sheep", abbr: "BS" },
  "no-kings": { slug: "no-kings", name: "No Kings", abbr: "NK" },
  "night-mode": { slug: "night-mode", name: "Night Mode", abbr: "NM" },
  "nyc-forever": { slug: "nyc-forever", name: "NYC Forever", abbr: "NY" },
  "hope-tomorrow": { slug: "hope-tomorrow", name: "Hope & Tomorrow", abbr: "HT" },
  "the-optimist": { slug: "the-optimist", name: "The Optimist", abbr: "TO" },
  essentials: { slug: "essentials", name: "Essentials", abbr: "ES" },
  "new-arrivals": { slug: "new-arrivals", name: "New Arrivals", abbr: "NA" },
};

export const DEFAULT_COLLECTION_CODE: CollectionCode = { slug: "all", name: "All collections", abbr: "ALL" };

export function getCollectionCode(slug: string): CollectionCode {
  return COLLECTION_CODES[slug] || DEFAULT_COLLECTION_CODE;
}
