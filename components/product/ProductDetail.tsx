"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product, Collection } from "@/lib/utils/types";
import { useCart } from "@/components/cart/CartProvider";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { getLineForCollection } from "@/lib/utils/subway-lines";
import { gsap, useGSAP } from "@/lib/gsap";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

interface ProductDetailProps {
  product: Product;
  related: Product[];
  collection?: Collection;
}

export function ProductDetail({ product, related, collection }: ProductDetailProps) {
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

  const line = collection ? getLineForCollection(collection.slug) : null;
  const lineColor = line?.color || "#1A1917";
  const lineTextColor = line?.color === "#FCCC0A" ? "#141414" : "#FFFFFF";

  // Check if the product description mentions "limited" or "exclusive"
  const isLimitedOrExclusive =
    product.description &&
    /limited|exclusive/i.test(product.description);

  const handleAddToCart = () => {
    if (!currentVariation) return;

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

  // Sanitized HTML rendering for product description from CMS
  const descriptionMarkup = product.description
    ? { __html: product.description }
    : null;

  return (
    <div className="pt-20 pb-20">
      {/* Breadcrumb navigation */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <nav aria-label="Breadcrumb" className="font-body font-medium text-[10px] md:text-[11px] text-muted flex items-center gap-2">
          <Link href="/shop" className="hover:text-muted transition-colors inline-flex items-center gap-1">
            <span className="opacity-50">&larr;</span> Shop
          </Link>
          {collection && (
            <>
              <span className="text-muted/60">&rarr;</span>
              <Link
                href={`/collections/${collection.slug}`}
                className="hover:text-muted transition-colors inline-flex items-center gap-1.5"
              >
                <RouteBadge slug={collection.slug} size="sm" />
                {collection.name}
              </Link>
            </>
          )}
          <span className="text-muted/60">&rarr;</span>
          <span className="text-muted/80">{product.name}</span>
        </nav>
      </div>

      {/* Product hero */}
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20">
        {/* Images */}
        <div className="space-y-4">
          <div className="relative aspect-[3/4] overflow-hidden bg-surface">
            {product.images[activeImage] ? (
              <Image
                src={product.images[activeImage]}
                alt={product.name}
                fill
                unoptimized={isPrintfulImage(product.images[activeImage])}
                className={`${
                  isPrintfulImage(product.images[activeImage]) ? "object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)]" : "object-cover"
                } transition-all duration-500 ease-out`}
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-elevated flex items-center justify-center">
                <span className="font-body font-medium text-sm text-muted">NO IMAGE</span>
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
                  className={`relative w-16 h-16 overflow-hidden border-b-2 transition-all duration-300 ${
                    i === activeImage
                      ? ""
                      : "border-transparent hover:border-muted"
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
        </div>

        {/* Details */}
        <div className="lg:py-8">
          {collection && (
            <div className="mb-4">
              <RouteBadge slug={collection.slug} size="lg" showName />
            </div>
          )}

          <h1 className="font-display font-bold text-4xl md:text-5xl lg:text-[3.25rem] leading-[1.05] mb-5 tracking-tight">
            {product.name}
          </h1>

          <p
            className="font-mono text-3xl md:text-[2rem] text-cream mb-8 tracking-wide"
            style={{ borderLeft: `3px solid ${lineColor}`, paddingLeft: '0.75rem' }}
          >
            {currentVariation?.priceFormatted || product.priceFormatted}
          </p>

          {/* Service Advisory for limited/exclusive products */}
          {isLimitedOrExclusive && (
            <div className="mb-8 border-l-4 border-[#FCCC0A] bg-[#FCCC0A]/10 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FCCC0A" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="font-body text-[10px] font-bold text-[#FCCC0A] uppercase tracking-[0.15em]">
                  Limited Release
                </span>
              </div>
              <p className="font-body text-[11px] text-[#FCCC0A]/80 leading-relaxed">
                Limited run. Once it's gone, it's gone.
              </p>
            </div>
          )}

          {/* Size/Variation selector */}
          {product.variations.length > 1 && (
            <div className="mb-8">
              <label id="size-label" className="font-body font-medium text-label text-muted uppercase tracking-[0.15em] block mb-3">
                Size
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="size-label">
                {product.variations.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariation(v.id)}
                    aria-pressed={v.id === selectedVariation}
                    className={`px-4 py-2 min-h-[44px] border font-body font-medium text-sm transition-all ${
                      v.id === selectedVariation
                        ? ""
                        : "border-border text-muted hover:border-cream hover:text-cream"
                    }`}
                    style={
                      v.id === selectedVariation
                        ? {
                            borderColor: lineColor,
                            backgroundColor: lineColor,
                            color: lineTextColor,
                          }
                        : undefined
                    }
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Turnstile "SWIPE TO ADD" button */}
          <button
            ref={btnRef}
            onClick={handleAddToCart}
            className="turnstile-btn metrocard-gradient w-full py-5 font-body font-bold text-base tracking-[0.08em] transition-all duration-300 cursor-pointer"
          >
            <span className="relative z-10">
              {addedFeedback ? (
                <span className="text-green-600">ADDED &#10003;</span>
              ) : (
                "ADD TO BAG"
              )}
            </span>
          </button>

          {/* Trust badges */}
          <div className="mt-6 py-6">
            <WhiteBand />
            <div className="flex items-center gap-3 pt-5 flex-wrap">
              <span className="font-body font-medium text-[10px] md:text-[11px] text-muted/70 flex items-center gap-1.5 tracking-wide uppercase">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Secure Checkout
              </span>
              <span className="text-muted/50 text-[9px]">&bull;</span>
              <span className="font-body font-medium text-[10px] md:text-[11px] text-muted/70 flex items-center gap-1.5 tracking-wide uppercase">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                Free Shipping $75+
              </span>
              <span className="text-muted/50 text-[9px]">&bull;</span>
              <span className="font-body font-medium text-[10px] md:text-[11px] text-muted/70 flex items-center gap-1.5 tracking-wide uppercase">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                Made to Order
              </span>
            </div>
          </div>

          {/* Description */}
          {descriptionMarkup && (
            <div className="mt-10">
              <WhiteBand />
              <div className="pt-8">
                <h2 className="font-display font-bold text-sm mb-4 text-muted uppercase tracking-wide">
                  About This Piece
                </h2>
                <div
                  className="font-body text-sm text-cream/80 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={descriptionMarkup}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related products - "NEXT TRAIN ARRIVING" — Subway Poster Cards */}
      {related.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 mt-28">
          <WhiteBand />
          <div className="sign-panel mb-1">
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
                            : "object-cover"
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
