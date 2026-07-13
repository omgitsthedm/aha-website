"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Collection, Product } from "@/lib/utils/types";
import type { ProductEnrichment } from "@/lib/data/enrichment";
import { useCart } from "@/components/cart/CartProvider";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { getFulfillmentSummary, RETURNS_SUMMARY, RETURNS_WINDOW } from "@/lib/commerce/policies";
import { trackCommerceEvent } from "@/lib/analytics/events";

interface ProductDetailProps {
  product: Product;
  related: Product[];
  collection?: Collection;
  enrichment?: ProductEnrichment | null;
  stockBySize?: Record<string, boolean>;
  storyDescription?: string;
}

const sanitizeHtml = (html: string): string => html
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
  .replace(/<object[\s\S]*?<\/object>/gi, "")
  .replace(/<embed[\s\S]*?\/?>/gi, "")
  .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
  .replace(/\s+on\w+\s*=\s*\S+/gi, "")
  .replace(/(?:href|src)\s*=\s*["']javascript:[^"']*["']/gi, "")
  .replace(/src\s*=\s*["']data:(?!image\/(?:png|jpe?g|gif|webp|svg\+xml))[^"']*["']/gi, "")
  .replace(/[—–]/g, "-");

const cleanDisplayText = (value: string): string => value.replace(/[—–]/g, "-");

export function ProductDetail({ product, related, collection, enrichment, stockBySize, storyDescription }: ProductDetailProps) {
  const { addItem } = useCart();
  const sizeInStock = (size: string) => stockBySize ? stockBySize[size.toUpperCase()] !== false : true;
  const variationAvailable = (name: string) => {
    const mapped = enrichment ? enrichment.purchasableBySize[name.toUpperCase()]?.ok === true : true;
    return mapped && sizeInStock(name);
  };
  const initialVariation = product.variations.find((variation) => variationAvailable(variation.name));
  const [selectedVariation, setSelectedVariation] = useState(initialVariation?.id || product.variations[0]?.id || "");
  const [activeImage, setActiveImage] = useState(0);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const feedbackTimer = useRef<number | null>(null);

  const currentVariation = product.variations.find((variation) => variation.id === selectedVariation);
  const currentSize = (currentVariation?.name || "").toUpperCase();
  const currentInStock = sizeInStock(currentSize);
  const purchasable = enrichment
    ? (enrichment.purchasableBySize[currentSize] ?? { ok: false, reasons: ["size unavailable"] })
    : { ok: true, reasons: [] };
  const canBuy = Boolean(currentVariation && currentInStock && purchasable.ok);

  const handleAddToCart = () => {
    if (!currentVariation || !canBuy) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      variationId: currentVariation.id,
      name: product.name,
      variationName: currentVariation.name,
      price: currentVariation.price,
      priceFormatted: currentVariation.priceFormatted,
      quantity: 1,
      image: product.images[0] || "",
    }, related);
    trackCommerceEvent({ name: "add_to_cart", itemId: product.id, variantId: currentVariation.id, valueCents: currentVariation.price, currency: product.currency, quantity: 1 });
    setAddedFeedback(true);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setAddedFeedback(false), 1800);
  };

  const descriptionMarkup = storyDescription || product.description
    ? { __html: sanitizeHtml(storyDescription || product.description) }
    : null;
  const activeImageSrc = product.images[activeImage];

  useEffect(() => {
    trackCommerceEvent({ name: "view_item", itemId: product.id, valueCents: product.price, currency: product.currency });
  }, [product.currency, product.id, product.price]);

  useEffect(() => () => {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
  }, []);

  return (
    <div className="px-4 pb-24 pt-28 md:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
          <Link href="/shop" className="min-h-11 py-3 transition-colors hover:text-accent">Shop</Link>
          {collection && (
            <>
              <span aria-hidden="true">/</span>
              <Link href={`/collections/${collection.slug}`} className="inline-flex min-h-11 items-center gap-2 transition-colors hover:text-accent">{collection.name}</Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:gap-16">
          <section aria-label="Product images">
            <div className="relative aspect-square overflow-hidden border border-border/40 bg-surface md:aspect-[4/5]">
              {activeImageSrc ? (
                <Image src={activeImageSrc} alt={product.name} fill className={`${isPrintfulImage(activeImageSrc) ? "object-contain" : "object-cover"} product-art`} sizes="(max-width: 1024px) 100vw, 58vw" priority />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold uppercase text-muted">Image unavailable</div>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Choose product image">
                {product.images.map((image, index) => (
                  <button key={image} type="button" onClick={() => setActiveImage(index)} aria-label={`View image ${index + 1} of ${product.images.length}`} aria-pressed={index === activeImage} className={`relative h-16 w-16 overflow-hidden border transition-colors ${index === activeImage ? "border-accent" : "border-border/40 hover:border-cream"}`}>
                    <Image src={image} alt="" fill className={isPrintfulImage(image) ? "object-contain" : "object-cover"} sizes="64px" />
                  </button>
                ))}
              </div>
            )}

            {activeImageSrc && <a href={activeImageSrc} target="_blank" rel="noopener noreferrer" className="mt-3 hidden min-h-11 items-center text-xs font-bold uppercase text-muted underline underline-offset-4 hover:text-cream md:inline-flex">Open full image</a>}
          </section>

          <section aria-labelledby="product-title" className="lg:pt-3">
            {collection && <p className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">{collection.name}</p>}
            <h1 id="product-title" className="max-w-2xl font-display text-[clamp(2.5rem,6vw,5.5rem)] font-bold uppercase leading-[0.86] tracking-[-0.05em] text-cream">{product.name}</h1>
            <p className="mt-6 font-mono text-2xl font-bold text-cream">{currentVariation?.priceFormatted || product.priceFormatted}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">Made to order in 2 to 5 business days. Free shipping. Returns accepted within {RETURNS_WINDOW} on unworn items.</p>

            {enrichment?.colors && enrichment.colors.length > 0 && (
              <div className="mt-8 border-t border-border/40 pt-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted">{enrichment.colors.length > 1 ? "Colors" : "Color"}</p>
                <div className="flex flex-wrap gap-2">{enrichment.colors.map((color) => <span key={color} className="border border-border/60 px-3 py-2 text-sm text-cream">{color}</span>)}</div>
              </div>
            )}

            {product.variations.length > 1 && (
              <fieldset className="mt-8 border-t border-border/40 pt-6">
                <legend className="sr-only">Choose a size</legend>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Size</p>
                    <p className="mt-1 text-xs leading-relaxed text-cream">{enrichment?.fitDescription ? cleanDisplayText(enrichment.fitDescription) : "Standard unisex fit. Choose your usual size."}</p>
                  </div>
                  <Link href="/size-guide" className="min-h-11 py-3 text-xs font-bold uppercase text-accent underline underline-offset-4">Size guide</Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.variations.map((variation) => {
                    const unavailable = !variationAvailable(variation.name);
                    const selected = variation.id === selectedVariation;
                    return (
                      <button key={variation.id} type="button" onClick={() => { setSelectedVariation(variation.id); trackCommerceEvent({ name: "select_variant", itemId: product.id, variantId: variation.id, valueCents: variation.price, currency: product.currency }); }} disabled={unavailable} aria-pressed={selected} aria-label={unavailable ? `${variation.name}, unavailable` : variation.name} className={`relative min-h-11 min-w-12 border px-4 py-2 text-sm font-bold transition-colors ${selected ? "border-accent bg-accent text-void" : "border-border/60 text-cream hover:border-accent"} ${unavailable ? "cursor-not-allowed text-muted line-through opacity-50" : ""}`}>
                        {variation.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <button type="button" onClick={handleAddToCart} disabled={!canBuy} aria-live="polite" className={`primary-action mt-8 min-h-14 w-full px-5 py-4 text-sm ${canBuy ? "" : "cursor-not-allowed opacity-50"}`}>
              {!canBuy ? "Unavailable" : addedFeedback ? "Added to bag" : `Add to bag | ${currentVariation?.priceFormatted || product.priceFormatted}`}
            </button>

            {!canBuy && <p role="status" className="mt-3 text-xs font-bold leading-relaxed text-warning">{!currentInStock ? "This size is out of stock right now." : "This size is not available right now."} <Link href={{ pathname: "/restock", query: { product: product.name, size: currentVariation?.name || "" } }} className="underline underline-offset-4">Request a restock alert</Link>.</p>}
            <p className="mt-3 text-xs leading-relaxed text-muted">{RETURNS_SUMMARY}</p>

            <div className="mt-8 border-y border-border/40 py-5">
              <dl className="grid gap-5 text-sm leading-relaxed sm:grid-cols-2">
                <div><dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Production</dt><dd className="mt-1 text-cream">{getFulfillmentSummary()}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Returns</dt><dd className="mt-1 text-cream">{RETURNS_WINDOW} for unworn pieces. <Link href="/returns" className="text-accent underline underline-offset-4">Read policy</Link></dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Fabric</dt><dd className="mt-1 text-cream">{enrichment?.fabricDescription ? cleanDisplayText(enrichment.fabricDescription) : "Printed to order."}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Care</dt><dd className="mt-1 text-cream">{enrichment?.careInstructions ? cleanDisplayText(enrichment.careInstructions) : "Machine wash cold, inside out. Do not iron the print."}</dd></div>
              </dl>
            </div>

            <ul className="mt-5 grid gap-2 text-xs font-bold uppercase tracking-[0.05em] text-muted sm:grid-cols-2" aria-label="Purchase assurances">
              <li className="border-l-2 border-accent pl-3">Secure Square checkout</li>
              <li className="border-l-2 border-accent pl-3">Free shipping</li>
              <li className="border-l-2 border-accent pl-3">Made to order</li>
              <li className="border-l-2 border-accent pl-3">Returns within {RETURNS_WINDOW}</li>
            </ul>

            {descriptionMarkup && (
              <div className="mt-10 border-t border-border/40 pt-7">
                <h2 className="font-display text-2xl font-black uppercase tracking-[-0.035em] text-cream">Design note</h2>
                <div className="prose prose-invert prose-sm mt-4 max-w-none font-body leading-relaxed text-cream/85" dangerouslySetInnerHTML={descriptionMarkup} />
              </div>
            )}
          </section>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related-title" className="mt-24 border-t border-border/40 pt-10">
            <div className="mb-7 flex items-end justify-between gap-4">
              <h2 id="related-title" className="font-display text-[clamp(2rem,5vw,4rem)] font-black uppercase leading-none tracking-[-0.05em]">Related pieces</h2>
              <Link href="/shop" className="min-h-11 py-3 text-xs font-bold uppercase text-accent underline underline-offset-4">Shop all</Link>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-5">
              {related.map((item) => {
                const image = item.images[0];
                return (
                  <Link key={item.id} href={`/product/${item.slug}`} className="group block">
                    <div className="relative aspect-[3/4] overflow-hidden border border-border/40 bg-surface">
                      {image ? <Image src={image} alt={item.name} fill className={isPrintfulImage(image) ? "object-contain transition-transform duration-300 group-hover:scale-[1.02]" : "object-cover transition-transform duration-300 group-hover:scale-[1.02]"} sizes="(max-width: 768px) 50vw, 25vw" /> : null}
                    </div>
                    <h3 className="mt-3 font-display text-sm font-black uppercase leading-tight">{item.name}</h3>
                    <p className="mt-1 text-xs font-bold text-muted">{item.priceFormatted}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
