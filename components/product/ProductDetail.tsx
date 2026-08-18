"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { ResilientImage } from "@/components/ui/ResilientImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Collection, Product } from "@/lib/utils/types";
import type { ProductEnrichment } from "@/lib/data/enrichment";
import { useCart } from "@/components/cart/CartProvider";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import {
  getFulfillmentSummary,
  PRODUCTION_WINDOW,
  RETURNS_SUMMARY,
  RETURNS_WINDOW,
  SHIPPING_CLAIM_DETAIL,
  SHIPPING_CLAIM_SHORT,
} from "@/lib/commerce/policies";
import { trackCommerceEvent } from "@/lib/analytics/events";
import { hapticTap } from "@/lib/utils/haptics";
import { extractVariationSize, extractVariationColor, groupVariationsByColor, sortVariationsBySize } from "@/lib/utils/variation";
import { splitProductName } from "@/lib/utils/product-name";
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

/**
 * One member of a design family — the same garment and graphic in a different
 * colour, sold as its own Square product and its own indexed slug.
 */
export interface ColorwayOption {
  slug: string;
  /** Full product name, used as the accessible name of the swatch. */
  name: string;
  /** Colour label from the title ("Dark Tan"), or "" when the title omits one. */
  color: string;
  /** Approximate swatch hex, or null when the colour is not in the swatch table. */
  hex: string | null;
  /** First gallery image — the true colour of the garment. */
  image: string;
  current: boolean;
}

interface ProductDetailProps {
  product: Product;
  related: Product[];
  collection?: Collection;
  enrichment?: ProductEnrichment | null;
  stockBySize?: Record<string, boolean>;
  storyDescription?: string;
  /** color name -> index in product.images showing that colorway */
  colorImageIndex?: Record<string, number>;
  /** Sibling colourways of this exact garment, including this product. */
  colorways?: ColorwayOption[];
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

// Both copies of the identity block are in the DOM at once and CSS-toggled, so
// only ONE of them may be an <h1> element: `as` picks which. The other keeps the
// heading SEMANTICS via role/aria-level, because the two copies are swapped with
// display:none and the mobile viewport would otherwise have no level-1 heading
// in its accessibility tree at all. No bare-element styles exist for either tag,
// so the swap is a zero-pixel change.
function ProductIdentity({ as: Heading = "h1", product, reviews, price, className = "" }: {
  as?: "h1" | "p";
  product: Product;
  reviews?: ReviewSummary;
  price: string;
  className?: string;
}) {
  const headingRole: { role?: "heading"; "aria-level"?: number } =
    Heading === "p" ? { role: "heading", "aria-level": 1 } : {};
  return (
    <div className={className}>
      {splitProductName(product.name).garment && (
        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted">{splitProductName(product.name).garment}</p>
      )}
      <Heading {...headingRole} className="editorial-title max-w-2xl text-[clamp(2.25rem,4.5vw,4rem)] text-cream">{splitProductName(product.name).name}</Heading>
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
      {/* Shipping wording comes from lib/commerce/policies.ts — international
          orders carry a real $25 Square service charge, so "free shipping"
          unqualified is not a claim this page is allowed to make. */}
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">Made to order in {PRODUCTION_WINDOW}. {SHIPPING_CLAIM_SHORT}, {SHIPPING_CLAIM_DETAIL.toLowerCase()}. Returns accepted within {RETURNS_WINDOW} on unworn items, and we cover return shipping.</p>
    </div>
  );
}

export function ProductDetail({ product, related, collection, enrichment, stockBySize, storyDescription, colorImageIndex, colorways, reviews, squareConfig }: ProductDetailProps) {
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

  const prefersReducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // What the sticky bar has always done for a shopper who has not picked a size:
  // move them to the control that is actually missing, and put the keyboard
  // there too. Used by both money buttons so neither has to be `disabled`.
  const goToSizeSelector = () => {
    const selector = document.getElementById("size-selector");
    if (!selector) return;
    selector.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    selector.querySelector<HTMLButtonElement>("[data-size-chips] button:not([disabled])")?.focus({ preventScroll: true });
  };

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

  // A `disabled` submit takes the primary conversion control out of the tab
  // order entirely, for the whole size-choosing session. The button stays
  // focusable and says what is missing instead; `handleAddToCart` still guards,
  // so an enabled button can never add an unpurchasable variation.
  const handlePrimaryAction = () => {
    if (canBuy) {
      handleAddToCart();
      return;
    }
    if (!currentVariation) goToSizeSelector();
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
    const onlyVariation = product.variations.length === 1 ? product.variations[0] : undefined;
    trackCommerceEvent({
      name: "view_item",
      itemId: product.id,
      itemName: product.name,
      itemVariant: onlyVariation?.name,
      valueCents: onlyVariation?.price ?? product.price,
      currency: product.currency,
      quantity: 1,
    });
  }, [product.currency, product.id, product.name, product.price, product.variations]);

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
          as="p"
          product={product}
          reviews={reviews}
          price={currentVariation?.priceFormatted || product.priceFormatted}
          className="mb-6 lg:hidden"
        />

        <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:gap-16">
          <section aria-label="Product images" className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <div
              className="frame relative aspect-[5/4] touch-pan-y overflow-hidden sm:aspect-[4/3] lg:aspect-[4/5]"
              onTouchStart={onImageTouchStart}
              onTouchEnd={onImageTouchEnd}
            >
              {activeImageSrc ? (
                <>
                  <ResilientImage src={activeImageSrc} alt={product.name} fill className={`${isPrintfulImage(activeImageSrc) ? "object-contain" : "object-cover"} product-art`} sizes="(max-width: 1024px) 100vw, 58vw" priority fetchPriority="high" />
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
              as="h1"
              product={product}
              reviews={reviews}
              price={currentVariation?.priceFormatted || product.priceFormatted}
              className="hidden lg:block"
            />

            {enrichment?.colors && enrichment.colors.length > 1 && (
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
                  <button type="button" onClick={() => { setSizeGuideOpen(true); trackCommerceEvent({ name: "view_size_guide", itemId: product.id, variantId: selectedVariation || undefined }); }} className="min-h-11 py-3 text-xs font-bold uppercase text-accent underline underline-offset-4">Size guide</button>
                </div>
                <div data-size-chips className="flex flex-wrap gap-2">
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

            {/* Sibling colourways. Colour is the primary variant axis on this
                catalog, but each colourway is its own Square product and its own
                indexed slug, so the only way to move between them is a link.
                Rendered under the size selector, and only when a sibling exists,
                so the PDPs with no colourway family gain no extra height. */}
            {colorways && colorways.length > 1 && (
              <div className="mt-6 border-t border-border/40 pt-5">
                <p id="colorway-label" className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">Other colorways</p>
                {/* One row that scrolls, not a wrapping grid: four chips wrap to
                    two lines at 375px and push the buy block ~165px down. Same
                    treatment as the gallery thumbnail strip above. */}
                <ul aria-labelledby="colorway-label" className="flex max-w-full gap-2 overflow-x-auto pb-1">
                  {colorways.map((option) => {
                    const chip = "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border px-2.5 py-1.5 text-sm";
                    // The garment photo is the honest swatch; the approximate hex
                    // is only a fallback for a colourway with no image at all.
                    const swatch = option.image ? (
                      <ResilientImage
                        src={option.image}
                        alt=""
                        width={28}
                        height={28}
                        className={`h-7 w-7 shrink-0 border border-border/40 ${isPrintfulImage(option.image) ? "object-contain" : "object-cover"}`}
                        fallback={<span aria-hidden="true" className="h-7 w-7 shrink-0 border border-border/40 bg-surface" />}
                      />
                    ) : option.hex ? (
                      <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/40" style={{ backgroundColor: option.hex }} />
                    ) : null;
                    return (
                      <li key={option.slug} className="shrink-0">
                        {option.current ? (
                          <span aria-current="true" className={`${chip} border-accent bg-rose text-cream`}>
                            {swatch}
                            {option.color || <span className="sr-only">{option.name}</span>}
                          </span>
                        ) : (
                          <Link
                            href={`/product/${option.slug}`}
                            aria-label={`View ${option.name}`}
                            className={`${chip} border-border/60 text-cream transition-colors hover:border-accent`}
                          >
                            {swatch}
                            {option.color}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
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
              <button
                type="button"
                onClick={handlePrimaryAction}
                aria-disabled={!canBuy}
                aria-describedby="pdp-buy-status"
                className={`btn-primary flex-1 ${canBuy ? "" : "cursor-not-allowed opacity-50"}`}
              >
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
              <span>{SHIPPING_CLAIM_SHORT}</span>
              <span aria-hidden="true" className="text-border">·</span>
              <span>Made with care</span>
            </p>

            {/* Mounted on every render so a state change is announced. A status
                node that mounts together with its own text is not reliably read,
                which is why the blocked reasons used to be silent. */}
            <div id="pdp-buy-status" role="status" aria-live="polite" className="text-xs font-bold leading-relaxed">
              {!currentVariation && product.variations.length > 1 && <p className="mt-3 text-warning">Choose a size to continue.</p>}
              {currentVariation && !canBuy && <p className="mt-3 text-warning">{!currentInStock ? "This size is out of stock right now." : "This size is not available right now."} <Link href={{ pathname: "/restock", query: { product: product.name, size: currentVariation.name } }} className="underline underline-offset-4">Request a restock alert</Link>.</p>}
              {canBuy && addedFeedback && <p className="mt-3 text-success">Added to bag.</p>}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">{RETURNS_SUMMARY}</p>

            {/* Details fold away. The page leads with the piece; the spec is one
                tap for the person who wants it. */}
            <div className="mt-8 border-t border-border/40">
              {[
                ["Fabric", enrichment?.fabricDescription ? cleanDisplayText(enrichment.fabricDescription) : "Printed to order."],
                ["Production & delivery", getFulfillmentSummary()],
                ["Returns", <>{RETURNS_WINDOW} for unworn pieces, return shipping on us. <Link href="/returns" className="text-accent underline underline-offset-4">Read policy</Link></>],
                ["Care", enrichment?.careInstructions ? cleanDisplayText(enrichment.careInstructions) : "Machine wash cold, inside out. Do not iron the print."],
              ].map(([label, body]) => (
                <details key={String(label)} className="group border-b border-border/40">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-cream">
                    <span>{label}</span><span aria-hidden="true" className="text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="pb-5 text-sm leading-relaxed text-muted">{body}</div>
                </details>
              ))}
            </div>

            {description.length > 0 && (
              <div className="mt-10 border-t border-border/40 pt-7">
                <h2 className="editorial-title text-3xl text-cream">The piece</h2>
                <div className="product-story mt-4 space-y-3 font-body leading-relaxed text-cream/85">
                  {description.map((block, index) => <p key={`${index}-${block.slice(0, 24)}`}>{block}</p>)}
                </div>
              </div>
            )}

            {/* Brand story on every PDP — the ownable narrative that otherwise
                only lived on the home + about pages. Honest; never niches the wearer.
                The city and the printing are deliberately in separate sentences: a
                single "drawn ... in New York, then printed to order" clause reads as
                a New York print claim, and production actually runs in Huntington
                Park CA or Philadelphia PA — the city the customer sees on the label.
                Design is the only NYC step (lib/commerce/policies.ts). */}
            <div className="mt-10 flex items-start gap-4 border-t border-border/40 pt-7">
              <SheepMark className="mt-1 w-12 shrink-0 text-cream" title="The After Hours Agenda black sheep" />
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">For the dreamers and the doers</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  After Hours Agenda makes clothes for the dreamers and the doers — good people who work hard, love hard, and celebrate the life they’re building. Every piece is made to order, one at a time, for you or for someone you love. Nothing is made before it’s wanted, and nothing is wasted.</p>
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
        sizeGuide={enrichment?.sizeGuide}
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
              <h2 id="related-title" className="editorial-title text-[clamp(2rem,4.5vw,3.75rem)] text-cream">More from the collection</h2>
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
          on phones. The consent prompt temporarily owns the fixed bottom surface,
          so this bar stays hidden and non-interactive until privacy is resolved. */}
      <div data-testid="sticky-buy-bar" data-aha-consent-gated-fixed="" className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-[80] border-t border-border/60 bg-void/95 backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {canBuy ? (
            <>
              {/* Once a size is chosen the bar carries both endings: the bag for
                  shoppers still browsing, and the one-tap path to checkout for
                  shoppers who are done. "Buy it now" previously rendered only in
                  the inline block, 1.46 viewports down, and never here. The price
                  yields first on narrow phones so neither label ever wraps. */}
              <p className="hidden shrink-0 font-display text-base font-black leading-none text-cream min-[400px]:block">
                {currentVariation?.priceFormatted || product.priceFormatted}
              </p>
              {/* .btn-secondary's default label is 11px and .btn-primary's is
                  13px (globals.css), so the pair would render at two different
                  sizes side by side. The sanctioned override is a text utility
                  on the button — see the note above the .btn-* font-size rules. */}
              <button type="button" onClick={handleAddToCart} className="btn-secondary min-w-0 flex-1 whitespace-nowrap text-[13px]">
                {addedFeedback ? "Added ✓" : "Add to bag"}
              </button>
              <button type="button" onClick={handleBuyNow} className="btn-primary min-w-0 flex-1 whitespace-nowrap">
                Buy it now
              </button>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{product.name}</p>
                <p className="font-display text-lg font-black leading-none text-cream">{currentVariation?.priceFormatted || product.priceFormatted}</p>
              </div>
              <button
                type="button"
                onClick={handlePrimaryAction}
                aria-disabled={Boolean(currentVariation)}
                // Same status node as the inline button. It lives in the buy
                // block, which renders at every viewport, so the reason an
                // aria-disabled sticky button is blocked is reachable here too.
                aria-describedby="pdp-buy-status"
                className={`btn-primary whitespace-nowrap ${currentVariation ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {currentVariation ? "Unavailable" : "Select size"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
