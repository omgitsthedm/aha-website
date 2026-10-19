// Products the owner removed from sale (Admin → Remove from sale) that stay in
// the code (src/data/off-sale.json). Removal itself is live at once from Netlify
// Blobs (retired.mjs); this list makes the next build agree for visitors and
// crawlers without JavaScript: off-sale products leave the sitemap, llms.txt and
// built feeds, their pages are noindex and "Discontinued", and their cards and
// collection groups are built hidden. Restore to sale in the admin shows them
// again at once (src/scripts/catalog-state.ts); take the slug off this list at
// the next deploy. `npm run catalog -- retire-sync` is the separate, permanent
// removal from the code, and needs the owner's say-so.
import data from "../../src/data/off-sale.json" with { type: "json" };

export const OFF_SALE = Object.freeze([...data.products]);
const set = new Set(OFF_SALE);

export const isOffSale = (slug) => set.has(slug);
export const onSale = (products) => products.filter((product) => !set.has(product.slug));
/** True when every piece is off sale (an empty list counts as off sale). */
export const allOffSale = (products) => products.every((product) => set.has(product.slug));
