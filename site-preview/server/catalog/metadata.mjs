/** Search/share copy identifies the exact garment and color without repeating specs. */
const DESCRIPTION_MIN = 120;
const DESCRIPTION_MAX = 160;
const SHIPPING = " Free U.S. shipping.";
export const productDescription = product => {
  const lead = `${product.title} in ${product.color}.`;
  const sentences = product.description.split(/(?<=\.)\s+/).map(s => s.trim().replace(/\.$/, "")).filter(Boolean);
  const write = (count, shipping) => `${lead} ${sentences.slice(0, count).join(". ")}.${shipping ? SHIPPING : ""}`;
  // Prefer the first sentence plus shipping; add a sentence when the snippet would run short.
  // Never run past what search results show.
  const options = [];
  for (let count = 1; count <= Math.max(1, sentences.length); count++) options.push(write(count, true), write(count, false));
  const fits = options.filter(text => text.length <= DESCRIPTION_MAX);
  return fits.find(text => text.length >= DESCRIPTION_MIN) ?? fits[0] ?? write(1, false);
};

/** Browser-tab and search titles carry the store name only when it still fits. */
const TITLE_SUFFIX = " | After Hours Agenda";
export const documentTitle = title => (title.length + TITLE_SUFFIX.length > 70 ? title : `${title}${TITLE_SUFFIX}`);
