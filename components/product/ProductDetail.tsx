"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { ResilientImage } from "@/components/ui/ResilientImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Collection, Product } from "@/lib/utils/types";
import type { ProductEnrichment } from "@/lib/data/enrichment";
import { useCart } from "@/components/cart/CartProvider";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { getFulfillmentSummary, RETURNS_SUMMARY, RETURNS_WINDOW } from "@/lib/commerce/policies";
import { trackCommerceEvent } from "@/lib/analytics/events";
import { hapticTap } from "@/lib/utils/haptics";
import { extractVariationSize, extractVariationColor, groupVariationsByColor, sortVariationsBySize } from "@/lib/utils/variation";
import { swatchHex } from "@/lib/data/color-swatches";
import { SizeGuideModal } from "@/components/product/SizeGuideModal";
import { ImageLightbox } from "@/components/product/ImageLightbox";
import { ProductReviews } from "@/components/product/ProductReviews";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { Stars } from "@/components/product/Stars";
import { PdpExpressCheckout } from "@/components/product/PdpExpressCheckout";
import { SheepMark } from "@/components/ui/SheepMark";
import type { ReviewSummary } from "@/lib/commerce/reviews";
import type { SquareWebPaymentsConfig } from "@/lib/commerce/runtime";

interface ProductDetailProps {
  product: Product;
  related: Product[];
  collection?: Collection;
  enrichment?: ProductEnrichment | null;
  stockBySize?: Record<string, boolean>;
  storyDescription?: string;
  /** color name -> index in product.images showing that colorway */
  colorImageIndex?: Record<string, number>;
  reviews?: ReviewSummary;
  squareConfig?: SquareWebPaymentsConfig;
}

const cleanDisplayText = (value: string): string => value.replace(/[—–]/g, "-");

const HTML_ENTITIES: Record<string, string> = {
  amp: "&", apos: "'", gt: ">", hellip: "…", lt: "<", mdash: "-", nbsp: " ", ndash: "-", quot: '"',
};

/** Convert provider-authored HTML to inert text blocks instead of trusting a regex sanitizer. */
const storyBlocks = (value: string): string[] => value
  .replace(/<(script|style|iframe|object)[^>]*>[\s\S]*?<\/\1>/gi, "")
  .replace(/<li[^>]*>/gi, "\n• ")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/(p|div|li|h[1-6]|ul|ol)>/gi, "\n\n")
  .replace(/<[^>]+>/g, "")
  .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const point = entity.startsWith("#x")
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  })
  .replace(/[—–]/g, "-")
  .split(/\n{2,}/)
  .map((block) => block.replace(/\s+/g, " ").trim())
  .filter(Boolean);

function ProductIdentity({ id, product, reviews, price, className = "" }: {
  id: string;
  product: Product;
  reviews?: ReviewSummary;
  price: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h1 id={id} className="max-w-2xl font-display text-[clamp(1.85rem,5.5vw,5.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.04em] text-cream sm:leading-[0.86]">{product.name}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-mono text-2xl font-bold text-cream">{price}</p>
        {reviews && reviews.count > 0 && (
          <a href="#reviews" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted transition-colors hover:text-cream" aria-label={`${reviews.average.toFixed(1)} out of 5 from ${reviews.count} ${reviews.count === 1 ? "review" : "reviews"}; read reviews`}>
            <Stars rating={reviews.average} />
            <span className="font-bold text-cream">{reviews.average.toFixed(1)}</span>
            <span>({reviews.count})</span>
          </a>
        )}
      </div>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">Made to order in 2 to 5 business days. Free shipping both ways. Returns accepted within {RETURNS_WINDOW} on unworn items.</p>
    </div>
  );
}

export function ProductDetail({ product, related, collection, enrichment, stockBySize, storyDescription, colorImageIndex, reviews, squareConfig }: ProductDetailProps) {
  const { addItem } = useCart();
  const router = useRouter();
  const sizeInStock = (size: string) => stockBySize ? stockBySize[extractVariationSize(size)] !== false : true;
  const variationAvailable = (name: string) => {
    const size = extractVariationSize(name);
    const mapped = enrichment ? enrichment.purchasableBySize[size]?.ok === true : true;
    return mapped && sizeInStock(size);
  };
  // A wrong apparel size is a costly default. Auto-select only when the product
  // genuinely has one variation; otherwise require an explicit shopper choice.
  const initialVariation = product.variations.length === 1
    ? (product.variations.find((variation) => variationAvailable(variation.name)) ?? product.variations[0])
    : undefined;
  const [selectedVariation, setSelectedVariation] = useState(initialVariation?.id || "");
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const MAX_QTY = 10;

  // Group "Color / Size" variations so the size row shows only the sizes that
  // exist for the chosen color. `enabled` is false for size-only products
  // (preview catalog, single-color), in which case we show every variation —
  // so the size list is never empty.
  const colorGroups = groupVariationsByColor(product.variations);
  const [selectedColor, setSelectedColor] = useState(
    colorGroups.enabled ? colorGroups.colors[0] : "",
  );
  const sizeVariations = sortVariationsBySize(colorGroups.enabled
    ? (colorGroups.byColor.get(selectedColor) ?? product.variations)
    : product.variations);

  // Switch color while preserving the shopper's chosen size when that size is
  // available in the new color. Otherwise clear the size instead of guessing.
  const selectColor = (color: string, imageIndex?: number) => {
    if (typeof imageIndex === "number") setActiveImage(imageIndex);
    if (!colorGroups.enabled) return;
    setSelectedColor(color);
    const previous = product.variations.find((variation) => variation.id === selectedVariation);
    const previousSize = extractVariationSize(previous?.name || "");
    const forColor = colorGroups.byColor.get(color) ?? [];
    const nextVariation = previousSize
      ? forColor.find((variation) => extractVariationSize(variation.name) === previousSize && variationAvailable(variation.name))
      : undefined;
    setSelectedVariation(nextVariation?.id ?? "");
  };
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const feedbackTimer = useRef<number | null>(null);
  const shareTimer = useRef<number | null>(null);
  const suppressZoomTimer = useRef<number | null>(null);

  // Inline gallery swipe (touch) — change the main image without opening the
  // lightbox. A horizontal swipe suppresses the tap-to-zoom click that follows.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressZoomRef = useRef(false);
  const changeImage = (dir: number) => {
    if (product.images.length < 2) return;
    setActiveImage((i) => (i + dir + product.images.length) % product.images.length);
    hapticTap();
  };
  const onImageTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const t = event.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onImageTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      suppressZoomRef.current = true; // this was a swipe, not a tap-to-zoom
      if (suppressZoomTimer.current) window.clearTimeout(suppressZoomTimer.current);
      suppressZoomTimer.current = window.setTimeout(() => { suppressZoomRef.current = false; }, 350);
      changeImage(dx < 0 ? 1 : -1);
    }
  };

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
    try {
      localStorage.setItem("aha-wishlist", JSON.stringify(next));
    } catch {
      // Safari private mode and storage quotas can reject writes. Keep the
      // interaction usable for this view even when persistence is unavailable.
    }
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
      quantity: qty,
      image: product.images[0] || "",
    }, related);
    trackCommerceEvent({ name: "add_to_cart", itemId: product.id, variantId: currentVariation.id, valueCents: currentVariation.price * qty, currency: product.currency, quantity: qty });
    hapticTap();
    setAddedFeedback(true);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setAddedFeedback(false), 1800);
  };

  // Buy it now: add silently (no cross-sell modal) and go straight to the
  // one-page checkout — the shortest find→buy→done path. Never charges here;
  // the sacred payment step still happens on /checkout.
  const handleBuyNow = () => {
    if (!currentVariation || !canBuy) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      variationId: currentVariation.id,
      name: product.name,
      variationName: currentVariation.name,
      price: currentVariation.price,
      priceFormatted: currentVariation.priceFormatted,
      quantity: qty,
      image: product.images[0] || "",
    }, undefined, { silent: true });
    trackCommerceEvent({ name: "add_to_cart", itemId: product.id, variantId: currentVariation.id, valueCents: currentVariation.price * qty, currency: product.currency, quantity: qty });
    hapticTap();
    router.push("/checkout");
  };


  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    let shared = false;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        shared = true;
      } else {
        await navigator.clipboard.writeText(url);
        shared = true;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        const copyField = document.createElement("textarea");
        copyField.value = url;
        copyField.setAttribute("readonly", "");
        copyField.style.position = "fixed";
        copyField.style.opacity = "0";
        document.body.appendChild(copyField);
        copyField.select();
        shared = document.execCommand("copy");
        copyField.remove();
      } catch {
        shared = false;
      }
    }
    if (shared) {
      setShareFeedback("Link copied");
      if (shareTimer.current) window.clearTimeout(shareTimer.current);
      shareTimer.current = window.setTimeout(() => setShareFeedback(""), 1800);
      trackCommerceEvent({ name: "share", itemId: product.id });
    }
  };

  const description = storyBlocks(storyDescription || product.description || "");
  const suppliedFit = enrichment?.fitDescription ? cleanDisplayText(enrichment.fitDescription) : "";
  const fitDescription = /women(?:'s)?/i.test(product.name) && /unisex/i.test(suppliedFit)
    ? "Women's fit. Check the garment measurements before choosing a size."
    : suppliedFit || "Check the garment measurements before choosing a size.";
  const activeImageSrc = product.images[activeImage];

  useEffect(() => {
    trackCommerceEvent({ name: "view_item", itemId: product.id, valueCents: product.price, currency: product.currency });
  }, [product.currency, product.id, product.price]);

  useEffect(() => () => {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    if (shareTimer.current) window.clearTimeout(shareTimer.current);
    if (suppressZoomTimer.current) window.clearTimeout(suppressZoomTimer.current);
  }, []);

  return (
    <div className="px-4 pb-32 pt-20 md:px-6 md:pt-24 lg:pb-24">
      <div className="mx-auto max-w-7xl">
        <nav aria-label="Breadcrumb" className="mb-4 flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted lg:mb-5">
          <Link href="/shop" className="inline-flex min-h-10 shrink-0 items-center transition-colors hover:text-accent">Shop</Link>
          {collection && (
            <>
              <span aria-hidden="true">/</span>
              <span className="shrink-0">{collection.name}</span>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="min-w-0 truncate">{product.name}</span>
        </nav>

        <ProductIdentity
          id="product-title-mobile"
          product={product}
          reviews={reviews}
          price={currentVariation?.priceFormatted || product.priceFormatted}
          className="mb-6 lg:hidden"
        />

        <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:gap-16">
          <section aria-label="Product images" className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <div
              className="fold-surface relative aspect-[5/4] touch-pan-y overflow-hidden sm:aspect-[4/3] lg:aspect-[4/5]"
              onTouchStart={onImageTouchStart}
              onTouchEnd={onImageTouchEnd}
            >
              {activeImageSrc ? (
                <>
                  <ResilientImage src={activeImageSrc} alt={product.name} fill className={`${isPrintfulImage(activeImageSrc) ? "object-contain" : "object-cover"} product-art`} sizes="(max-width: 1024px) 100vw, 58vw" priority />
                  <button type="button" onClick={() => { if (suppressZoomRef.current) { suppressZoomRef.current = false; return; } setLightboxOpen(true); }} aria-label="Zoom image" className="absolute inset-0 cursor-zoom-in" />
                  {product.images.length > 1 && (
                    <div aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-void/80 px-2.5 py-1 font-mono text-[10px] font-bold text-cream">
                      {activeImage + 1} / {product.images.length}
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold uppercase text-muted">Image unavailable</div>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="mt-3 flex w-full max-w-full gap-2 overflow-x-auto pb-1" role="group" aria-label="Choose product image">
                {product.images.map((image, index) => (
                  <button key={image} type="button" onClick={() => setActiveImage(index)} aria-label={`View image ${index + 1} of ${product.images.length}`} aria-pressed={index === activeImage} className={`relative h-16 w-16 shrink-0 overflow-hidden border transition-colors ${index === activeImage ? "border-accent" : "border-border/40 hover:border-cream"}`}>
                    <ResilientImage src={image} alt="" fill className={isPrintfulImage(image) ? "object-contain" : "object-cover"} sizes="64px" />
                  </button>
                ))}
              </div>
            )}

            {activeImageSrc && <button type="button" onClick={() => setLightboxOpen(true)} className="mt-3 inline-flex min-h-11 items-center text-xs font-bold uppercase text-muted underline underline-offset-4 hover:text-cream">Zoom &amp; view full</button>}
          </section>

          <section className="min-w-0 lg:pt-3">
            {collection && <p className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">{collection.name}</p>}
            <ProductIdentity
              id="product-title"
              product={product}
              reviews={reviews}
              price={currentVariation?.priceFormatted || product.priceFormatted}
              className="hidden lg:block"
            />

            {enrichment?.colors && enrichment.colors.length > 0 && (
              <div className="mt-8 border-t border-border/40 pt-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted">{enrichment.colors.length > 1 ? "Colors" : "Color"}</p>
                <div className="flex flex-wrap gap-2">
                  {enrichment.colors.map((color) => {
                    const imageIndex = colorImageIndex?.[color];
                    const hasImage = typeof imageIndex === "number";
                    const isShown = colorGroups.enabled ? selectedColor === color : hasImage && imageIndex === activeImage;
                    const hex = swatchHex(color);
                    const dot = hex ? (
                      <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/40" style={{ backgroundColor: hex }} />
                    ) : null;
                    return hasImage ? (
                      <button
                        key={color}
                        type="button"
                        onClick={() => selectColor(color, imageIndex)}
                        aria-pressed={isShown}
                        aria-label={`Show ${color} colorway`}
                        className={`inline-flex min-h-11 items-center gap-2 border px-3 py-2 text-sm transition-colors ${isShown ? "border-accent bg-rose text-cream" : "border-border/60 text-cream hover:border-accent"}`}
                      >
                        {dot}
                        {color}
                      </button>
                    ) : (
                      <span key={color} className="inline-flex min-h-11 items-center gap-2 border border-border/60 px-3 py-2 text-sm text-cream">{dot}{color}</span>
                    );
                  })}
                </div>
              </div>
            )}

            {product.variations.length > 1 && (
              <fieldset id="size-selector" className="mt-8 scroll-mt-28 border-t border-border/40 pt-6">
                <legend className="sr-only">Choose a size</legend>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Size</p>
                    <p className="mt-1 text-xs leading-relaxed text-cream">{fitDescription}</p>
                  </div>
                  <button type="button" onClick={() => setSizeGuideOpen(true)} className="min-h-11 py-3 text-xs font-bold uppercase text-accent underline underline-offset-4">Size guide</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizeVariations.map((variation) => {
                    const unavailable = !variationAvailable(variation.name);
                    const selected = variation.id === selectedVariation;
                    // When colors are split out, the chip shows just the size.
                    const label = colorGroups.enabled ? extractVariationSize(variation.name) : variation.name;
                    return (
                      <button key={variation.id} type="button" onClick={() => { setSelectedVariation(variation.id); trackCommerceEvent({ name: "select_variant", itemId: product.id, variantId: variation.id, valueCents: variation.price, currency: product.currency }); }} disabled={unavailable} aria-pressed={selected} aria-label={unavailable ? `${variation.name}, unavailable` : variation.name} className={`relative min-h-11 min-w-12 border px-4 py-2 text-sm font-bold transition-colors ${selected ? "border-accent bg-rose text-cream" : "border-border/60 text-cream hover:border-accent"} ${unavailable ? "cursor-not-allowed text-muted line-through opacity-50" : ""}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="mt-8 flex items-center gap-4">
              <span id="qty-label" className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Qty</span>
              <div className="inline-flex items-center border border-border/60" role="group" aria-labelledby="qty-label">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity" className="min-h-11 w-11 text-lg font-bold text-cream transition-colors hover:text-accent disabled:opacity-40">&minus;</button>
                <span aria-live="polite" className="min-w-10 border-x border-border/60 py-2 text-center text-sm font-bold text-cream">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))} disabled={qty >= MAX_QTY} aria-label="Increase quantity" className="min-h-11 w-11 text-lg font-bold text-cream transition-colors hover:text-accent disabled:opacity-40">+</button>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button type="button" onClick={handleAddToCart} disabled={!canBuy} aria-live="polite" className={`btn-primary flex-1 ${canBuy ? "" : "cursor-not-allowed opacity-50"}`}>
                {!currentVariation ? "Choose a size" : !canBuy ? "Unavailable" : addedFeedback ? "Added to bag" : `Add to bag - ${currentVariation.priceFormatted}`}
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
              <span className="sr-only" aria-live="polite">{shareFeedback}</span>
            </div>

            {/* One-tap wallet, above the fold. Lazy-loads the Square SDK only on
                intent (hover/focus/tap) — honors "SDK loads only on payment". */}
            {squareConfig && currentVariation && (
              <PdpExpressCheckout
                key={`${currentVariation.id}-${qty}`}
                squareConfig={squareConfig}
                line={{ squareVariationId: currentVariation.id, quantity: qty }}
                subtotalCents={currentVariation.price * qty}
                itemSnapshot={{
                  name: product.name,
                  variationName: currentVariation.name,
                  quantity: qty,
                  productId: product.id,
                  slug: product.slug,
                  variationId: currentVariation.id,
                  price: currentVariation.price,
                  priceFormatted: currentVariation.priceFormatted,
                  image: product.images[0] || "",
                }}
                disabled={!canBuy}
              />
            )}

            {canBuy && (
              <button type="button" onClick={handleBuyNow} className="btn-secondary mt-3 w-full justify-center">
                Buy it now
              </button>
            )}

            {/* Trust signal at the decision point. */}
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              <span>Secure checkout with Square</span>
              <span aria-hidden="true" className="text-border">·</span>
              <span>Free shipping</span>
              <span aria-hidden="true" className="text-border">·</span>
              <span>Designed in NYC</span>
            </p>

            {!currentVariation && product.variations.length > 1 && <p role="status" className="mt-3 text-xs font-bold leading-relaxed text-warning">Choose a size to continue.</p>}
            {currentVariation && !canBuy && <p role="status" className="mt-3 text-xs font-bold leading-relaxed text-warning">{!currentInStock ? "This size is out of stock right now." : "This size is not available right now."} <Link href={{ pathname: "/restock", query: { product: product.name, size: currentVariation.name } }} className="underline underline-offset-4">Request a restock alert</Link>.</p>}
            <p className="mt-3 text-xs leading-relaxed text-muted">{RETURNS_SUMMARY}</p>

            <div className="mt-8 border-y border-border/40 py-5">
              <dl className="grid gap-5 text-sm leading-relaxed sm:grid-cols-2">
                <div><dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Production</dt><dd className="mt-1 text-cream">{getFulfillmentSummary()}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Returns</dt><dd className="mt-1 text-cream">{RETURNS_WINDOW} for unworn pieces. <Link href="/returns" className="text-accent underline underline-offset-4">Read policy</Link></dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Fabric</dt><dd className="mt-1 text-cream">{enrichment?.fabricDescription ? cleanDisplayText(enrichment.fabricDescription) : "Printed to order."}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Care</dt><dd className="mt-1 text-cream">{enrichment?.careInstructions ? cleanDisplayText(enrichment.careInstructions) : "Machine wash cold, inside out. Do not iron the print."}</dd></div>
              </dl>
            </div>

            <ul className="mt-5 grid gap-x-5 gap-y-3 text-xs font-bold uppercase tracking-[0.05em] text-muted sm:grid-cols-2" aria-label="Purchase assurances">
              <li className="border-t border-border/40 pt-2">Secure Square checkout</li>
              <li className="border-t border-border/40 pt-2">Free shipping</li>
              <li className="border-t border-border/40 pt-2">Made to order</li>
              <li className="border-t border-border/40 pt-2">Returns within {RETURNS_WINDOW}</li>
            </ul>

            {description.length > 0 && (
              <div className="mt-10 border-t border-border/40 pt-7">
                <h2 className="font-display text-2xl font-black uppercase tracking-[-0.035em] text-cream">Product details</h2>
                <div className="product-story mt-4 space-y-3 font-body leading-relaxed text-cream/85">
                  {description.map((block, index) => <p key={`${index}-${block.slice(0, 24)}`}>{block}</p>)}
                </div>
              </div>
            )}

            {/* Brand story on every PDP — the ownable narrative that otherwise
                only lived on the home + about pages. Honest; never niches the wearer. */}
            <div className="mt-10 flex items-start gap-4 border-t border-border/40 pt-7">
              <SheepMark className="mt-1 w-12 shrink-0 text-cream" title="The After Hours Agenda black sheep" />
              <div>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent">Made after hours</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Every After Hours Agenda design is drawn when the day quiets down in New York, then printed to order one at a time. Expressive everyday clothing for anyone who never needed permission to belong to the city.{" "}
                  <Link href="/about" className="font-bold text-accent underline underline-offset-4 hover:text-cream">The story</Link>.
                </p>
              </div>
            </div>
          </section>
        </div>

      <SizeGuideModal
        isOpen={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        fitDescription={enrichment?.fitDescription}
        careInstructions={enrichment?.careInstructions}
        catalogVariantId={enrichment ? Object.values(enrichment.catIdBySize)[0] : undefined}
      />

      <ImageLightbox
        images={product.images}
        index={activeImage}
        alt={product.name}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setActiveImage}
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
                      {image ? <ResilientImage src={image} alt={item.name} fill className={isPrintfulImage(image) ? "object-contain transition-transform duration-300 group-hover:scale-[1.02]" : "object-cover transition-transform duration-300 group-hover:scale-[1.02]"} sizes="(max-width: 768px) 50vw, 25vw" /> : null}
                    </div>
                    <h3 className="mt-3 font-display text-sm font-black uppercase leading-tight">{item.name}</h3>
                    <p className="mt-1 text-xs font-bold text-muted">{item.priceFormatted}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <RecentlyViewed current={{ slug: product.slug, name: product.name, image: product.images[0] || "", priceFormatted: product.priceFormatted }} />

        <ProductReviews productSlug={product.slug} initial={reviews ?? { items: [], count: 0, average: 0 }} />
      </div>

      {/* Sticky mobile buy bar — the inline Add-to-bag can sit far below the fold
          on phones. Adds a persistent price + action without touching desktop. */}
      <div data-testid="sticky-buy-bar" className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-[80] border-t border-border/60 bg-void/95 backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{product.name}</p>
            <p className="font-display text-lg font-black leading-none text-cream">{currentVariation?.priceFormatted || product.priceFormatted}</p>
          </div>
          <button
            type="button"
            onClick={
              canBuy
                ? handleAddToCart
                : () => document.getElementById("size-selector")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" })
            }
            className={`btn-primary whitespace-nowrap ${!canBuy && (currentInStock === false) ? "cursor-not-allowed opacity-50" : ""}`}
            disabled={!canBuy && currentInStock === false && Boolean(currentVariation)}
          >
            {canBuy
              ? addedFeedback ? "Added ✓" : "Add to bag"
              : currentVariation ? "Unavailable" : "Select size"}
          </button>
        </div>
      </div>
    </div>
  );
}
