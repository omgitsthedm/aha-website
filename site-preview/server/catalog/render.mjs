// Renders a product page for a product published live (no deploy) by taking a
// built product page as the shell and replacing only what is product-specific:
// the <main> region and the head metadata. tests/live-catalog.test.mjs renders
// every built product this way and requires byte-identical output to Astro's
// build, so this file must change whenever src/pages/shop/[product].astro or
// src/components/ProductCard.astro / ProductImage.astro change.
import { garmentGroup, hoverView, otherColors, swatchFor } from "./garments.mjs";

const ESCAPABLE = /[&<>'"]/g;
const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
/** Astro text escaping. */
export const text = (value) => String(value ?? "").replace(ESCAPABLE, (char) => ENTITIES[char]);
/** Astro attribute escaping (only & and "). */
export const attr = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

const GALLERY_LABELS = { front: "Front", back: "Back", "print-detail": "Print detail", folded: "Folded" };
const measurement = (value) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

function image(shot, { priority = false, sizes, name }) {
  return `<img src="${attr(shot.src)}" srcset="${attr(shot.srcset)}" sizes="${attr(sizes)}" alt="${attr(shot.alt)}" width="${attr(shot.width)}" height="${attr(shot.height)}" loading="${priority ? "eager" : "lazy"}" fetchpriority="${priority ? "high" : "low"}" decoding="${priority ? "sync" : "async"}"${name ? ` style="${attr(`view-transition-name:${name}`)}"` : ""}>`;
}

export function productCard(product) {
  const first = product.variants[0]?.size;
  const last = product.variants.at(-1)?.size;
  const swap = hoverView(product);
  const swapAttrs = swap ? ` data-swap-src="${attr(swap.src)}" data-swap-srcset="${attr(swap.srcset)}"` : "";
  return `<article class="product-card" data-type="${attr(garmentGroup(product.typeLabel))}"><a class="product-card-image" href="/shop/${attr(product.slug)}/" aria-label="${attr(`Shop ${product.title} in ${product.color}`)}"${swapAttrs}>${image(product.gallery[0], { sizes: "(max-width: 760px) calc(50vw - 28px), (max-width: 1440px) calc(45.6vw - 16px), 640px", name: `p-${product.slug}` })}</a><div class="product-card-info"><div><h2><a href="/shop/${attr(product.slug)}/">${text(product.title)}</a></h2><p>${text(product.color)} · ${text(first)}–${text(last)}</p></div><p class="product-price">$${text(product.price)}</p></div></article>`;
}

function productSchema(product, gallery, origin) {
  return {
    "@context": "https://schema.org", "@type": "ProductGroup", name: `${product.title} — ${product.color}`, description: product.description,
    productGroupID: product.squareItemId, brand: { "@type": "Brand", name: "After Hours Agenda" }, color: product.color, material: product.composition,
    image: gallery.map((shot) => new URL(shot.feedImage, origin).href), variesBy: ["https://schema.org/size"],
    hasVariant: product.variants.map((variant) => ({
      "@type": "Product", name: `${product.title} — ${product.color} — ${variant.size}`, sku: variant.sku, size: variant.size, color: product.color, image: new URL(gallery[0].feedImage, origin).href,
      offers: { "@type": "Offer", url: `${origin}/shop/${product.slug}/?size=${encodeURIComponent(variant.size)}`, price: product.price, priceCurrency: "USD", availability: "https://schema.org/InStock", itemCondition: "https://schema.org/NewCondition", seller: { "@type": "Organization", name: "After Hours Agenda" }, shippingDetails: { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "USD" }, shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" } } },
    })),
  };
}

/** The <main> element of /shop/<slug>/ exactly as Astro renders it. */
export function renderProductMain(product, products, { origin, pageScript }) {
  const gallery = product.gallery.slice(0, 4);
  const related = [
    ...products.filter((entry) => entry.slug !== product.slug && entry.collection === product.collection),
    ...products.filter((entry) => entry.slug !== product.slug && entry.collection !== product.collection),
  ].slice(0, 4);
  const sizeGuide = product.sizeGuide.map((row) => ({ ...row, sleeveLength: "sleeveLength" in row ? row.sleeveLength : undefined }));
  const sleeves = sizeGuide.every((row) => typeof row.sleeveLength === "number");
  const swatch = swatchFor(product.color);
  const siblings = otherColors(product, products);
  return [
    `<main id="main" tabindex="-1">`,
    `<div class="shell product-breadcrumb"><a href="/shop/">← All pieces</a><span>Fall / Winter 2026</span></div>`,
    `<section class="shell product-layout" data-product-id="${attr(product.squareItemId)}" data-product-name="${attr(product.title)}" data-product-color="${attr(product.color)}" data-product-price="${attr(product.price)}">`,
    `<div class="product-visuals"><div class="product-gallery" role="region" tabindex="0" aria-label="${attr(`${product.title} garment views; scroll to see all four`)}">`,
    gallery.map((shot, index) => `<figure id="view-${index + 1}">${image(shot, { priority: index === 0, sizes: "(max-width: 760px) 100vw, 55vw", name: index === 0 ? `p-${product.slug}` : undefined })}<figcaption>${text(GALLERY_LABELS[shot.role])}</figcaption></figure>`).join(""),
    `</div><p class="image-note">Product mockups. Colors and print placement can vary slightly in production.</p></div>`,
    `<div class="product-details"><p class="label">${text(product.collection)} / ${text(product.typeLabel)}</p><h1>${text(product.title)}</h1>`,
    `<div class="product-price-row"><p class="product-price">$${text(product.price)}<span> USD</span></p><p>Free domestic shipping</p></div>`,
    `<p class="color-choice"><span class="color-swatch" style="${attr(`--swatch:${swatch}`)}" aria-hidden="true"></span> ${text(product.color)}</p>`,
    siblings.length ? `<p class="color-options">Also in ${siblings.map((entry) => `<a class="color-option" href="/shop/${attr(entry.slug)}/"><span class="color-swatch" style="${attr(`--swatch:${swatchFor(entry.color)}`)}" aria-hidden="true"></span> ${text(entry.color)}</a>`).join("")}</p>` : "",
    `<p>${text(product.description)}</p>`,
    `<form class="product-purchase" data-cart-form><p class="label">Choose a size</p><div class="size-options" role="radiogroup" aria-label="${attr(`${product.title} size`)}" aria-required="true">`,
    product.variants.map((variant) => `<label><input type="radio" name="size" value="${attr(variant.id)}" data-cart-variant data-size="${attr(variant.size)}" data-sku="${attr(variant.sku)}"><span>${text(variant.size)}</span></label>`).join(""),
    `</div><label class="quantity-field">Quantity <input data-cart-quantity name="quantity" type="number" min="1" max="10" step="1" value="1" inputmode="numeric"></label><button type="submit" class="button add-to-bag">Add to bag <span aria-hidden="true">+</span></button><p class="cart-add-status" data-cart-add-status aria-live="polite"></p></form>`,
    `<a class="text-link size-link" href="#size-guide">Check measurements ↓</a><p class="checkout-note">Free domestic shipping. Final tax and payment options are shown securely at checkout.</p>`,
    `<details open><summary>Fit &amp; fabric</summary><ul class="product-facts"><li>${text(product.fit)}.</li><li>${text(product.weightOz)} oz ${text(product.fabricType)}.</li><li>${text(product.composition)}.</li>${product.constructionDetails.map((detail) => `<li>${text(detail)}</li>`).join("")}</ul></details>`,
    `<details><summary>Shipping &amp; returns</summary><p>Made to order. Production usually takes about a week; shipping time varies by destination. Domestic shipping is free.</p><p>Request a return within 30 days of delivery for an unworn, unwashed item. Contact us before sending anything back.</p><p><a href="/shipping/">Shipping details</a> · <a href="/returns/">Return policy</a></p></details>`,
    `<details><summary>Care</summary><p>Follow the label on your garment. Where permitted, wash cold and inside out. Do not iron directly on the print.</p></details></div></section>`,
    `<section class="shell section size-guide" id="size-guide" aria-labelledby="size-title"><p class="label">Finished garment measurements · inches</p><h2 id="size-title">Find your fit.</h2><p>${text(product.measurementGuidance)}</p>${product.sleeveMeasurementGuidance ? `<p>${text(product.sleeveMeasurementGuidance)}</p>` : ""}`,
    `<div class="size-table-wrap" role="region" aria-label="${attr(`${product.title} measurements`)}" tabindex="0"><table><thead><tr><th scope="col">Size</th><th scope="col">Chest width</th><th scope="col">Body length</th>${sleeves ? `<th scope="col">Sleeve length</th>` : ""}</tr></thead><tbody>`,
    sizeGuide.map((row) => `<tr><th scope="row">${text(row.size)}</th><td>${text(measurement(row.chestWidth))}</td><td>${text(measurement(row.bodyLength))}</td>${sleeves ? `<td>${typeof row.sleeveLength === "number" ? text(measurement(row.sleeveLength)) : ""}</td>` : ""}</tr>`).join(""),
    `</tbody></table></div></section>`,
    `<section class="section shell"><div class="section-header"><h2>More pieces.</h2><a href="/shop/" class="text-link">Shop all →</a></div><div class="product-grid related-products">${related.map(productCard).join("")}</div></section>`,
    products.flatMap((entry) => entry.variants.map((variant) => `<template data-cart-catalog data-id="${attr(variant.id)}" data-sku="${attr(variant.sku)}" data-size="${attr(variant.size)}" data-slug="${attr(entry.slug)}" data-title="${attr(`${entry.title} — ${entry.color}`)}" data-color="${attr(entry.color)}" data-price-cents="${attr(entry.price * 100)}" data-image="${attr(entry.gallery[0].src)}" data-image-alt="${attr(entry.gallery[0].alt)}"></template>`)).join(""),
    `<script type="application/ld+json">${json(productSchema(product, gallery, origin))}</script>`,
    pageScript,
    `</main>`,
  ].join("");
}

function replaceOnce(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`Product shell is missing ${label}.`);
  return html.replace(pattern, replacement);
}

/** Parts of a built product page that a live render reuses unchanged. */
export function parseShell(html) {
  const mainStart = html.indexOf("<main id=\"main\"");
  const mainEnd = html.indexOf("</main>");
  if (mainStart < 0 || mainEnd < 0) throw new Error("Product shell has no <main>.");
  const main = html.slice(mainStart, mainEnd);
  const scripts = [...main.matchAll(/<script type="module"[^>]*>[\s\S]*?<\/script>|<script type="module" src="[^"]+"><\/script>/g)].map((match) => match[0]);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (!canonical) throw new Error("Product shell has no canonical link.");
  return { html, mainStart, mainEnd: mainEnd + "</main>".length, pageScript: scripts.at(-1) ?? "", origin: new URL(canonical).origin };
}

/** A complete page for `product`, built from another product's page. */
export function renderLivePage(shellHtml, product, products) {
  const shell = parseShell(shellHtml);
  const { origin } = shell;
  const title = `${product.title} — ${product.color}`;
  const canonical = `${origin}/shop/${product.slug}/`;
  const cover = product.gallery[0];
  let head = shell.html.slice(0, shell.mainStart);
  const tail = shell.html.slice(shell.mainEnd);
  head = replaceOnce(head, /<title>[^<]*<\/title>/, `<title>${text(title)} | After Hours Agenda</title>`, "title");
  head = replaceOnce(head, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(product.description)}">`, "description");
  head = replaceOnce(head, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${attr(canonical)}">`, "canonical");
  const meta = { "og:title": `${title} | After Hours Agenda`, "og:description": product.description, "og:url": canonical, "og:image": new URL(cover.feedImage, origin).href, "og:image:width": String(cover.width), "og:image:height": String(cover.height), "og:image:alt": cover.alt };
  for (const [property, value] of Object.entries(meta)) head = replaceOnce(head, new RegExp(`<meta property="${property}" content="[^"]*">`), `<meta property="${property}" content="${attr(value)}">`, property);
  const twitter = { "twitter:title": `${title} | After Hours Agenda`, "twitter:description": product.description, "twitter:image": new URL(cover.feedImage, origin).href };
  for (const [name, value] of Object.entries(twitter)) head = replaceOnce(head, new RegExp(`<meta name="${name}" content="[^"]*">`), `<meta name="${name}" content="${attr(value)}">`, name);
  head = replaceOnce(head, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (_match, body) => {
    const schema = JSON.parse(body.replace(/\\u003c/g, "<"));
    for (const node of schema["@graph"] ?? []) {
      if (node["@type"] === "WebPage") Object.assign(node, { "@id": canonical, url: canonical, name: title, description: product.description });
      if (node["@type"] === "BreadcrumbList") Object.assign(node.itemListElement[1], { name: title, item: canonical });
    }
    return `<script type="application/ld+json">${json(schema)}</script>`;
  }, "site schema");
  return head + renderProductMain(product, products, { origin, pageScript: shell.pageScript }) + tail;
}
