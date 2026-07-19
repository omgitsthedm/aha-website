import type { Product, Collection } from "@/lib/utils/types";
import type { ProductEnrichment } from "@/lib/data/enrichment";
import { loadProductMap } from "@/lib/data/products";

/** fullDescription from the manifest, only when explicitly authored (factory spec.story). */
function getAuthoredStory(slug: string): string | null {
  try {
    const manifest = loadProductMap().get(slug) as { storySource?: string; fullDescription?: string } | undefined;
    if (manifest?.storySource === "authored" && manifest.fullDescription) {
      return manifest.fullDescription.replace(/[—–]/g, "-");
    }
  } catch {
    // manifest unavailable — fall back to the generated story
  }
  return null;
}

/**
 * True when the Square `product.description` is real, human-authored copy worth
 * showing verbatim (e.g. "No crowns. No thrones. No permission needed…") rather
 * than empty/boilerplate. When authored, the PDP should render IT — not the
 * auto-generated fallback story — so the brand's own words reach the shopper.
 */
export function isAuthoredSquareDescription(desc?: string | null): boolean {
  if (!desc) return false;
  const text = desc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 60) return false;
  // Reject the generic auto-templated boilerplate.
  if (/\bby After Hours Agenda\.\s*Printed to order\.?\s*$/i.test(text)) return false;
  if (/printed to order as a graphic/i.test(text) && text.length < 200) return false;
  // Reject raw Printful supplier boilerplate so it never becomes a meta/PDP story;
  // these products fall back to the authored brand template instead.
  if (/comfortable, soft, lightweight|ideal staple piece for any wardrobe|100% (ring-spun )?cotton|printed on demand|ethically sourced|blank product sourced/i.test(text)) return false;
  // Authored copy carries real markup or is a substantial multi-sentence story.
  return /<(p|strong|ul|li|br|em)\b/i.test(desc) || text.length >= 140;
}

const TYPE_NAMES: Record<string, string> = {
  accessory: "accessory",
  hat: "headwear piece",
  hoodie: "hoodie",
  jacket: "jacket",
  sticker: "sticker",
  sweater: "sweatshirt",
  tee: "graphic tee",
};

const clean = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// "a accessory" -> "an accessory". Vowel-sound heuristic is enough for our type nouns.
const article = (word: string) => (/^[aeiou]/i.test(word.trim()) ? "an" : "a");

interface StoryTerritory {
  pattern: RegExp;
  line: (name: string) => string;
}

// Design context is intentionally inferred only from the customer-facing title. These lines add
// useful editorial context without inventing materials, collaborators, scarcity, or product history.
const STORY_TERRITORIES: StoryTerritory[] = [
  {
    pattern: /no kings|enemy of the state|deny.*defend.*depose|fascist|don.t lick the boot|genocide|libert|revolution|start a riot/i,
    line: () => "A statement graphic about self-rule, resistance, and refusing the easy line.",
  },
  {
    pattern: /hope|tomorrow|believe|optimist|just trying my best|be you|crush it/i,
    line: () => "Optimism with its eyes open: a graphic for keeping your nerve and moving anyway.",
  },
  {
    pattern: /new york|avenue b|cities|you are here|nys|native/i,
    line: () => "A city-minded graphic that carries New York without turning it into a souvenir.",
  },
  {
    pattern: /book|library|read|scarlet letter|cover story|loose receipts/i,
    line: () => "A reader's graphic for library stacks, marked-up pages, and the ideas that follow you home.",
  },
  {
    pattern: /club|party|rock|emo|technoir|number 7/i,
    line: () => "Built around the part of the night where sound, style, and bad timing become the whole point.",
  },
  {
    pattern: /flower|garden|palms|waves|cut grass|haze|hot air/i,
    line: () => "A natural motif interpreted as a graphic for this product.",
  },
  {
    pattern: /retro|roaring 20s|eras to remember|classic|winter track/i,
    line: () => "An archive-minded graphic that treats nostalgia as raw material, not a dress code.",
  },
  {
    pattern: /ninja turtles|super bros|waldo|glen coco|link.s lawn|fuck walter/i,
    line: () => "A pop-memory graphic for the references that refuse to stay in the past.",
  },
];

function designContext(name: string): string {
  const territory = STORY_TERRITORIES.find(({ pattern }) => pattern.test(name));
  return territory?.line(name) ?? `${name} starts with the graphic and lets everything else stay out of its way.`;
}

function practicalClose(type: string): string {
  if (type === "accessory" || type === "hat") {
    return "Check the product options, care guidance, free shipping, and 30-day return terms before ordering.";
  }
  if (type === "hoodie" || type === "sweater" || type === "jacket") {
    return "Use the live size options and fit note to choose your layer, then review care, delivery, and 30-day return terms.";
  }
  return "Use the live size options and fit note to choose your cut, then review care, free shipping, and 30-day return terms.";
}

export function buildProductStory(
  product: Product,
  enrichment?: ProductEnrichment | null,
  collection?: Collection,
): string {
  // An authored story (written at design time, factory spec.story) is the
  // truth of the design — it always beats the generated template.
  const authored = getAuthoredStory(product.slug);
  if (authored) return authored;
  const productType = enrichment?.productType || "";
  const type = TYPE_NAMES[productType] || "piece";
  const collectionLine = collection?.description
    ? ` In the ${clean(collection.name)} collection, it sits inside this idea: ${clean(collection.description)}`
    : " It is part of the current After Hours Agenda product catalog.";
  const fabric = enrichment?.fabricDescription
    ? ` Made with ${clean(enrichment.fabricDescription).replace(/\.$/, "").toLowerCase()}.`
    : "";

  return `${designContext(product.name)} ${product.name} is printed to order as ${article(type)} ${type}.${collectionLine}${fabric} ${practicalClose(productType)}`;
}
