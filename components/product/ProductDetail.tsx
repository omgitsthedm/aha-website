"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product, Collection } from "@/lib/utils/types";
import type { ProductEnrichment } from "@/lib/data/enrichment";
import { useCart } from "@/components/cart/CartProvider";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { getLineForCollection } from "@/lib/utils/subway-lines";
import { gsap, useGSAP } from "@/lib/gsap";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import {
  getFulfillmentSummary,
  RETURNS_SUMMARY,
  RETURNS_WINDOW,
} from "@/lib/commerce/policies";

interface ProductDetailProps {
  product: Product;
  related: Product[];
  collection?: Collection;
  enrichment?: ProductEnrichment | null;
  /** Live Printful stock by upper-cased size. false = out of stock. */
  stockBySize?: Record<string, boolean>;
}

export function ProductDetail({ product, related, collection, enrichment, stockBySize }: ProductDetailProps) {
  const { addItem } = useCart();
  const [selectedVariation, setSelectedVariation] = useState(
    product.variations[0]?.id || ""
  );
  const [activeImage, setActiveImage] = useState(0);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const currentVariation = product.variations.find(
    (v) => v.id === selectedVariation
  );

  // Purchasable gate for the selected size. If the product is mapped (has enrichment) but this
  // size isn't a known purchasable variant, fail CLOSED. Only products with no manifest match
  // at all default to allowed (live Square item not yet in the internal catalog).
  const currentSize = (currentVariation?.name || "").toUpperCase();
  const purchasable = enrichment
    ? (enrichment.purchasableBySize[currentSize] ?? { ok: false, reasons: ["size unavailable"] })
    : { ok: true, reasons: [] };
  const sizeInStock = (size: string) => (stockBySize ? stockBySize[size.toUpperCase()] !== false : true);
  const currentInStock = sizeInStock(currentSize);
  const canBuy = purchasable.ok && currentInStock;

  const line = collection ? getLineForCollection(collection.slug) : null;
  const lineColor = line?.color || "#1A1917";
  const lineTextColor = [
    "#39FF14",
    "#00FFFF",
    "#CCFF00",
    "#FCCC0A",
    "#FFAA00",
    "#FF7F00",
    "#B5A642",
  ].includes(lineColor)
    ? "#10100F"
    : "#E9E1D4";

  // Check if the product description mentions "limited" or "exclusive"
  const isLimitedOrExclusive =
    product.description &&
    /limited|exclusive/i.test(product.description);

  const handleAddToCart = () => {
    if (!currentVariation || !canBuy) return;

    addItem(
      {
        productId: product.id,
        slug: product.slug,
        variationId: currentVariation.id,
        name: product.name,
        variationName: currentVariation.name,
        price: currentVariation.price,
        priceFormatted: currentVariation.priceFormatted,
        quantity: 1,
        image: product.images[0] || "",
      },
      related
    );

    // Turnstile swipe animation
    const btn = btnRef.current;
    if (btn) {
      btn.classList.add("swiped");
      setAddedFeedback(true);

      gsap.fromTo(
        btn,
        { scale: 1 },
        {
          scale: 1.02,
          duration: 0.2,
          yoyo: true,
          repeat: 1,
          ease: "power2.out",
        }
      );

      setTimeout(() => {
        btn.classList.remove("swiped");
        setAddedFeedback(false);
      }, 2000);
    }
  };

  // Sanitize HTML from CMS — strip script tags, event handlers, and dangerous elements
  // while preserving safe formatting (p, strong, em, br, ul, li, etc.)
  const sanitizeHtml = (html: string): string => {
    return html
      // Remove script/style/iframe tags and their content
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
      .replace(/<object[\s\S]*?<\/object>/gi, "")
      .replace(/<embed[\s\S]*?\/?>/gi, "")
      // Remove event handlers (onclick, onerror, onload, etc.)
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\s+on\w+\s*=\s*\S+/gi, "")
      // Remove javascript: protocol in href/src
      .replace(/(?:href|src)\s*=\s*["']javascript:[^"']*["']/gi, "")
      // Remove data: protocol in src (except safe image types)
      .replace(/src\s*=\s*["']data:(?!image\/(?:png|jpe?g|gif|webp|svg\+xml))[^"']*["']/gi, "");
  };

  const descriptionMarkup = product.description
    ? { __html: sanitizeHtml(product.description) }
    : null;

  return (
    <div className="px-4 pb-20 pt-28 md:px-6 md:pt-32">
      {/* Breadcrumb navigation */}
      <div className="max-w-7xl mx-auto py-4">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
          <Link href="/shop" className="transition-colors hover:text-[#CCFF00]">
            Shop
          </Link>
          {collection && (
            <>
              <span className="text-muted/60">/</span>
              <Link
                href={`/collections/${collection.slug}`}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-[#CCFF00]"
              >
                <RouteBadge slug={collection.slug} size="sm" />
                {collection.name}
              </Link>
            </>
          )}
          <span className="text-muted/60">/</span>
          <span className="text-muted/80">{product.name}</span>
        </nav>
      </div>

      {/* Product hero */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Images */}
        <div className="space-y-4">
          <div className="zine-block zine-cut relative aspect-[3/4] overflow-hidden bg-surface">
            {product.images[activeImage] ? (
              <Image
                src={product.images[activeImage]}
                alt={product.name}
                fill
                unoptimized={isPrintfulImage(product.images[activeImage])}
                className={`${
                  isPrintfulImage(product.images[activeImage]) ? "object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)]" : "object-cover xerox-image"
                } transition-all duration-500 ease-out`}
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-elevated flex items-center justify-center">
                <span className="font-body text-sm font-bold uppercase text-muted">No image</span>
              </div>
            )}
          </div>

          {/* Image thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-2" role="group" aria-label="Product images">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  aria-label={`View image ${i + 1} of ${product.images.length}`}
                  aria-current={i === activeImage ? "true" : undefined}
                  className={`relative h-16 w-16 overflow-hidden border-[3px] transition-all duration-300 ${
                    i === activeImage
                      ? ""
                      : "border-[#E9E1D4]/35 hover:border-[#E9E1D4]"
                  }`}
                  style={
                    i === activeImage
                      ? { borderColor: lineColor }
                      : undefined
                  }
                >
                  <Image
                    src={img}
                    alt={`${product.name} view ${i + 1}`}
                    fill
                    unoptimized={isPrintfulImage(img)}
                    className={isPrintfulImage(img) ? "object-contain" : "object-cover"}
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}

          {product.images[activeImage] && (
            <a
              href={product.images[activeImage]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center border-[3px] border-[#E9E1D4] bg-[#15110F] px-4 py-2 font-body text-xs font-bold uppercase tracking-[0.08em] text-[#E9E1D4] underline underline-offset-4 transition-colors hover:bg-[#E9E1D4] hover:text-[#10100F]"
            >
              Open full image
            </a>
          )}
        </div>

        {/* Details */}
        <div className="lg:py-8">
          {collection && (
            <div className="mb-4">
              <RouteBadge slug={collection.slug} size="lg" showName />
            </div>
          )}

          <h1 className="misprint font-display text-[clamp(3rem,7vw,6rem)] font-black uppercase leading-[0.82] tracking-[-0.08em] mb-6">
            {product.name}
          </h1>

          <p
            className="mb-8 inline-block border-[4px] bg-[#15110F] px-4 py-3 font-mono text-3xl font-bold tracking-wide text-cream md:text-[2rem]"
            style={{ borderColor: lineColor, boxShadow: `7px 7px 0 ${lineColor}` }}
          >
            {currentVariation?.priceFormatted || product.priceFormatted}
          </p>

          <div className="zine-block mb-8 p-4 md:p-5">
            <h2 className="mb-4 font-display text-2xl font-black uppercase leading-none tracking-[-0.05em] text-cream">
              Before You Buy
            </h2>
            <dl className="grid gap-4 font-body text-sm font-bold leading-relaxed md:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-muted">
                  Production
                </dt>
                <dd className="mt-1 text-cream">{getFulfillmentSummary()}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-muted">
                  Returns
                </dt>
                <dd className="mt-1 text-cream">
                  {RETURNS_WINDOW} for unworn pieces.{" "}
                  <Link
                    href="/returns"
                    className="text-[#CCFF00] underline underline-offset-4"
                  >
                    Read policy
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-muted">
                  Fit
                </dt>
                <dd className="mt-1 text-cream">
                  {enrichment?.fitDescription || "Standard unisex fit — true to size."}{" "}
                  <Link
                    href="/size-guide"
                    className="text-[#00FFFF] underline underline-offset-4"
                  >
                    Size guide
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-muted">
                  Fabric
                </dt>
                <dd className="mt-1 text-cream">
                  {enrichment?.fabricDescription || "Premium print, made to order."}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-muted">
                  Care
                </dt>
                <dd className="mt-1 text-cream">
                  {enrichment?.careInstructions || "Machine wash cold, inside out. Do not iron the print."}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-muted">
                  Checkout
                </dt>
                <dd className="mt-1 text-cream">
                  Secure Square checkout. Free shipping — the price you see is the price you pay.
                </dd>
              </div>
            </dl>
          </div>

          {/* Service Advisory for limited/exclusive products */}
          {isLimitedOrExclusive && (
            <div className="zine-paper mb-8 px-4 py-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-body text-[11px] font-bold text-[#10100F] uppercase tracking-[0.08em]">
                  Limited Release
                </span>
              </div>
              <p className="font-body text-[12px] font-bold leading-relaxed text-[#10100F]">
                Limited run. Once it&apos;s gone, it&apos;s gone.
              </p>
            </div>
          )}

          {/* Colors (from Printful) */}
          {enrichment?.colors && enrichment.colors.length > 0 && (
            <div className="mb-6">
              <span className="font-body font-bold text-label text-muted uppercase tracking-[0.12em] block mb-2">
                {enrichment.colors.length > 1 ? "Colors" : "Color"}
              </span>
              <div className="flex flex-wrap gap-2">
                {enrichment.colors.map((c) => (
                  <span key={c} className="border-[3px] border-[#E9E1D4] px-3 py-1.5 font-body text-sm font-bold text-cream">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Size/Variation selector */}
          {product.variations.length > 1 && (
            <div className="mb-8">
              <label id="size-label" className="font-body font-bold text-label text-muted uppercase tracking-[0.12em] block mb-3">
                Size
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="size-label">
                {product.variations.map((v) => {
                  const oos = !sizeInStock(v.name);
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariation(v.id)}
                      aria-pressed={v.id === selectedVariation}
                      aria-label={oos ? `${v.name} — out of stock` : v.name}
                      className={`relative min-h-[44px] border-[3px] px-4 py-2 font-body text-sm font-bold transition-all ${
                        oos ? "text-muted line-through decoration-2 opacity-60" : ""
                      } ${
                        v.id === selectedVariation
                          ? ""
                          : "border-[#E9E1D4] text-muted hover:border-cream hover:text-cream"
                      }`}
                      style={
                        v.id === selectedVariation
                          ? { borderColor: lineColor, backgroundColor: lineColor, color: lineTextColor }
                          : undefined
                      }
                    >
                      {v.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add to bag */}
          <button
            ref={btnRef}
            onClick={handleAddToCart}
            disabled={!canBuy}
            aria-live="polite"
            aria-disabled={!canBuy}
            className={`turnstile-btn metrocard-gradient w-full py-5 font-body text-base font-bold tracking-[0.08em] transition-all duration-300 ${
              canBuy ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            }`}
          >
            <span className="relative z-10">
              {!canBuy ? (
                "SOLD OUT"
              ) : addedFeedback ? (
                <span className="text-[#10100F]">Added</span>
              ) : (
                `ADD TO BAG - ${currentVariation?.priceFormatted || product.priceFormatted}`
              )}
            </span>
          </button>
          {!canBuy && (
            <p className="mt-2 font-body text-xs font-bold leading-relaxed text-[#FFAA00]">
              {!currentInStock ? "This size is out of stock right now." : "This size isn't available right now."}{" "}
              <Link href="/contact" className="underline underline-offset-4">Ask us about a restock</Link>.
            </p>
          )}

          <p className="mt-3 font-body text-xs font-bold leading-relaxed text-muted">
            {RETURNS_SUMMARY}
          </p>

          {/* Trust badges */}
          <div className="mt-6 py-6">
            <WhiteBand />
            <div className="flex flex-wrap items-center gap-3 pt-5">
              <span className="zine-sticker bg-[#00FFFF]">
                Secure Checkout
              </span>
              <span className="zine-sticker bg-[#CCFF00]">
                Free Shipping
              </span>
              <span className="zine-sticker bg-[#FFAA00]">
                Made to Order
              </span>
              <span className="zine-sticker bg-[#FF1493] text-[#E9E1D4]">
                30-Day Returns
              </span>
            </div>
          </div>

          {/* Description */}
          {descriptionMarkup && (
            <div className="mt-10">
              <WhiteBand />
              <div className="pt-8">
                <h2 className="font-display font-black text-2xl mb-4 text-cream uppercase tracking-[-0.04em]">
                  About This Piece
                </h2>
                <div
                  className="font-body text-sm font-bold text-cream/85 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={descriptionMarkup}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <div className="max-w-7xl mx-auto mt-28">
          <WhiteBand />
          <div className="sign-panel my-2">
            <span className="sign-panel-text">You Might Also Like</span>
          </div>
          <WhiteBand />
          <div className="mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p) => {
              const isPrintful = isPrintfulImage(p.images[0]);

              return (
                <Link key={p.id} href={`/product/${p.slug}`} className="group block product-card-hover">
                  <div className="subway-poster aspect-[3/4] bg-surface">
                    {p.images[0] ? (
                      <Image
                        src={p.images[0]}
                        alt={p.name}
                        fill
                        unoptimized={isPrintful}
                        className={`${
                          isPrintful
                          ? "object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                            : "object-cover xerox-image"
                        } transition-transform duration-700 group-hover:scale-105`}
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-elevated" />
                    )}

                    {/* Poster info scrim */}
                    <div className="subway-poster-scrim">
                      <h3 className="font-display font-bold text-xs md:text-sm text-[#E8E4DE] uppercase tracking-[0.06em] truncate">
                        {p.name}
                      </h3>
                      <p className="font-mono text-xs md:text-sm font-semibold text-[#FCCC0A] mt-0.5">
                        {p.priceFormatted}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
