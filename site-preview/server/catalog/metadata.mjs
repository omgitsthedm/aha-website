/** Search/share copy identifies the exact garment and color without repeating specs. */
export const productDescription = product => `${product.title} in ${product.color}. ${product.description.split('. ')[0].replace(/\.$/, '')}. Free U.S. shipping.`;
