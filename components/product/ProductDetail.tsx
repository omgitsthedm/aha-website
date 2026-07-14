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
import { hapticTap } from "@/lib/utils/haptics";
import { extractVariationSize } from "@/lib/utils/variation";
import { SizeGuideModal } from "@/components/product/SizeGuideModal";

interface ProductDetailProps {
  product: Product;
  related: Product[];
  collection?: Collection;
  enrichment?: ProductEnrichment | null;
  stockBySize?: Record<string, boolean>;
  storyDescription?: string;
  /** color name -> index in product.images showing that colorway */
  colorImageIndex?: Record<string, number>;
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

export function ProductDetail({ product, related, collection, enrichment, stockBySize, storyDescription, colorImageIndex }: ProductDetailProps) {
  const { addItem } = useCart();
  const sizeInStock = (size: string) => stockBySize ? stockBySize[extractVariationSize(size)] !== false : true;
  const variationAvailable = (name: string) => {
    const size = extractVariationSize(name);
    const mapped = enrichment ? enrichment.purchasableBySize[size]?.ok === true : true;
    return mapped && sizeInStock(size);
  };
  const initialVariation = product.variations.find((variation) => variationAvailable(variation.name));
  const [selectedVariation, setSelectedVariation] = useState(initialVariation?.id || product.variations[0]?.id || "");
  const [activeImage, setActiveImage] = useState(0);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const feedbackTimer = useRef<number | null>(null);

  const readWishlist = (): string[] => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("aha-wishlist") : null;
      const list = saved ? JSON.parse(saved) : [];
      return Array.isArray(list) ? list.filter((s): s is string => typeof s === "string") : [];
    } catch {
      return []; // corrupted storage — start clean, never throw into render/handler
    }
  };

  useEffect(() => {
    setWishlisted(readWishlist().includes(product.slug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  const toggleWishlist = () => {
    const list = readWishlist();
    const next = wishlisted ? list.filter((s) => s !== product.slug) : [...list, product.slug];
    localStorage.setItem("aha-wishlist", JSON.stringify(next));
    setWishlisted(!wishlisted);
    trackCommerceEvent({ name: wishlisted ? "remove_from_wishlist" : "add_to_wishlist", itemId: product.id });
  };

  const currentVariation = product.variations.find((variation) => variation.id === selectedVariation);
  const currentSize = extractVariationSize(currentVariation?.name || "");
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
    hapticTap();
    setAddedFeedback(true);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setAddedFeedback(false), 1800);
  };


  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      trackCommerceEvent({ name: "share", itemId: product.id });
    } catch {
      /* user dismissed the sheet */
    }
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
            <div className="fold-surface relative aspect-square overflow-hidden md:aspect-[4/5]">
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
            <h1 id="product-title" className="max-w-2xl font-display text-[clamp(1.85rem,5.5vw,5.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.04em] text-cream sm:leading-[0.86]">{product.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <p className="font-mono text-2xl font-bold text-cream">{currentVariation?.priceFormatted || product.priceFormatted}</p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">Made to order in 2 to 5 business days. Free shipping. Returns accepted within {RETURNS_WINDOW} on unworn items.</p>

            {enrichment?.colors && enrichment.colors.length > 0 && (
              <div className="mt-8 border-t border-border/40 pt-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted">{enrichment.colors.length > 1 ? "Colors" : "Color"}</p>
                <div className="flex flex-wrap gap-2">
                  {enrichment.colors.map((color) => {
                    const imageIndex = colorImageIndex?.[color];
                    const hasImage = typeof imageIndex === "number";
                    const isShown = hasImage && imageIndex === activeImage;
                    return hasImage ? (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setActiveImage(imageIndex)}
                        aria-pressed={isShown}
                        aria-label={`Show ${color} colorway`}
                        className={`min-h-11 border px-3 py-2 text-sm transition-colors ${isShown ? "border-accent bg-rose text-cream" : "border-border/60 text-cream hover:border-accent"}`}
                      >
                        {color}
                      </button>
                    ) : (
                      <span key={color} className="inline-flex min-h-11 items-center border border-border/60 px-3 py-2 text-sm text-cream">{color}</span>
                    );
                  })}
                </div>
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
                  <button type="button" onClick={() => setSizeGuideOpen(true)} className="min-h-11 py-3 text-xs font-bold uppercase text-accent underline underline-offset-4">Size guide</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.variations.map((variation) => {
                    const unavailable = !variationAvailable(variation.name);
                    const selected = variation.id === selectedVariation;
                    return (
                      <button key={variation.id} type="button" onClick={() => { setSelectedVariation(variation.id); trackCommerceEvent({ name: "select_variant", itemId: product.id, variantId: variation.id, valueCents: variation.price, currency: product.currency }); }} disabled={unavailable} aria-pressed={selected} aria-label={unavailable ? `${variation.name}, unavailable` : variation.name} className={`relative min-h-11 min-w-12 border px-4 py-2 text-sm font-bold transition-colors ${selected ? "border-accent bg-rose text-cream" : "border-border/60 text-cream hover:border-accent"} ${unavailable ? "cursor-not-allowed text-muted line-through opacity-50" : ""}`}>
                        {variation.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="mt-8 flex gap-3">
              <button type="button" onClick={handleAddToCart} disabled={!canBuy} aria-live="polite" className={`btn-primary flex-1 ${canBuy ? "" : "cursor-not-allowed opacity-50"}`}>
                {!canBuy ? "Unavailable" : addedFeedback ? "Added to bag" : `Add to bag — ${currentVariation?.priceFormatted || product.priceFormatted}`}
              </button>
              <button
                type="button"
                onClick={toggleWishlist}
                aria-pressed={wishlisted}
                aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                className={`inline-flex h-14 w-14 items-center justify-center border transition-colors ${wishlisted ? "border-accent bg-rose text-cream" : "border-border/10 text-muted hover:border-accent hover:text-cream"}`}
              >
                <svg className="h-5 w-5" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleShare}
                aria-label={`Share ${product.name}`}
                className="inline-flex h-14 w-14 items-center justify-center border border-border/10 text-muted transition-colors hover:border-accent hover:text-cream"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              </button>
            </div>

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
                <h2 className="font-display text-2xl font-black uppercase tracking-[-0.035em] text-cream">Product details</h2>
                <div className="product-story mt-4 font-body leading-relaxed text-cream/85" dangerouslySetInnerHTML={descriptionMarkup} />
              </div>
            )}
          </section>
        </div>

      <SizeGuideModal
        isOpen={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        fitDescription={enrichment?.fitDescription}
        careInstructions={enrichment?.careInstructions}
      />

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
