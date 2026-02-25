export interface SubwayLine {
  slug: string;
  name: string;
  abbr: string;
  color: string;
  tailwind: string;
  mtaLine: string;
}

export const SUBWAY_LINES: Record<string, SubwayLine> = {
  "black-sheep": {
    slug: "black-sheep",
    name: "Black Sheep",
    abbr: "BS",
    color: "#EE352E",
    tailwind: "line-red",
    mtaLine: "1/2/3",
  },
  "no-kings": {
    slug: "no-kings",
    name: "No Kings",
    abbr: "NK",
    color: "#2850AD",
    tailwind: "line-blue",
    mtaLine: "A/C/E",
  },
  "night-mode": {
    slug: "night-mode",
    name: "Night Mode",
    abbr: "NM",
    color: "#FF6319",
    tailwind: "line-orange",
    mtaLine: "B/D/F/M",
  },
  "nyc-forever": {
    slug: "nyc-forever",
    name: "NYC Forever",
    abbr: "NY",
    color: "#00933C",
    tailwind: "line-green",
    mtaLine: "4/5/6",
  },
  "new-arrivals": {
    slug: "new-arrivals",
    name: "New Arrivals",
    abbr: "NA",
    color: "#FCCC0A",
    tailwind: "line-yellow",
    mtaLine: "N/Q/R/W",
  },
};

export const DEFAULT_LINE: SubwayLine = {
  slug: "unknown",
  name: "All Lines",
  abbr: "AL",
  color: "#A7A9AC",
  tailwind: "line-gray",
  mtaLine: "S",
};

export function getLineForCollection(slug: string): SubwayLine {
  return SUBWAY_LINES[slug] || DEFAULT_LINE;
}

export function getLineForCollectionId(
  collectionId: string,
  collections: { id: string; slug: string }[]
): SubwayLine {
  const col = collections.find((c) => c.id === collectionId);
  if (!col) return DEFAULT_LINE;
  return getLineForCollection(col.slug);
}
