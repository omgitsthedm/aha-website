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
    color: "#39FF14",
    tailwind: "neon-green",
    mtaLine: "ZINE",
  },
  "no-kings": {
    slug: "no-kings",
    name: "No Kings",
    abbr: "NK",
    color: "#FF006E",
    tailwind: "line-red",
    mtaLine: "RIOT",
  },
  "night-mode": {
    slug: "night-mode",
    name: "Night Mode",
    abbr: "NM",
    color: "#BF00FF",
    tailwind: "neon-purple",
    mtaLine: "AFTER",
  },
  "nyc-forever": {
    slug: "nyc-forever",
    name: "NYC Forever",
    abbr: "NY",
    color: "#00FFFF",
    tailwind: "line-blue",
    mtaLine: "CITY",
  },
  "hope-tomorrow": {
    slug: "hope-tomorrow",
    name: "Hope & Tomorrow",
    abbr: "HT",
    color: "#FFAA00",
    tailwind: "line-sunrise",
    mtaLine: "SUN",
  },
  "the-optimist": {
    slug: "the-optimist",
    name: "The Optimist",
    abbr: "TO",
    color: "#FF7F00",
    tailwind: "line-purple",
    mtaLine: "LOUD",
  },
  "essentials": {
    slug: "essentials",
    name: "Essentials",
    abbr: "ES",
    color: "#B5A642",
    tailwind: "line-silver",
    mtaLine: "BASE",
  },
  "new-arrivals": {
    slug: "new-arrivals",
    name: "New Arrivals",
    abbr: "NA",
    color: "#FCCC0A",
    tailwind: "line-yellow",
    mtaLine: "NEW",
  },
};

export const DEFAULT_LINE: SubwayLine = {
  slug: "unknown",
  name: "All Lines",
  abbr: "AL",
  color: "#7A7A7A",
  tailwind: "line-gray",
  mtaLine: "ALL",
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
