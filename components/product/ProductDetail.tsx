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
  const lineColor = line?.color || "#E8E4DE";
  const lineTextColor = line?.color === "#FCCC0A" ? "#141414" : "#FFFFFF";

  // Check if the product description mentions "limited" or "exclusive"
  const isLimitedOrExclusive =
    product.description &&
    /limited|exclusive/i.test(product.description);

  const handleAddToCart = () => {
    if (!currentVariation) return;

    addItem({
      productId: product.id,
      variationId: currentVariation.id,
      name: product.name,
      variationName: currentVariation.name,
      price: currentVariation.price,
      priceFormatted: currentVariation.priceFormatted,
      quantity: 1,
      image: product.images[0] || "",
    });

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
      {/* Station signage breadcrumb */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <nav className="font-mono text-[10px] text-muted/60 flex items-center gap-2">
          <Link href="/shop" className="hover:text-muted transition-colors inline-flex items-center gap-1">
            <span className="opacity-50">&larr;</span> PLATFORM
          </Link>
          {collection && (
            <>
              <span className="text-muted/25">&rarr;</span>
              <Link
                href={`/collections/${collection.slug}`}
                className="hover:text-muted transition-colors inline-flex items-center gap-1.5"
              >
                <RouteBadge slug={collection.slug} size="sm" />
                {collection.name}
              </Link>
            </>
          )}
          <span className="text-muted/25">&rarr;</span>
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
                className={`${
                  isPrintfulImage(product.images[activeImage]) ? "object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]" : "object-cover"
                } transition-all duration-500 ease-out`}
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-elevated flex items-center justify-center">
                <span className="font-mono text-sm text-muted">NO IMAGE</span>
              </div>
            )}
          </div>

          {/* Image thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-2">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
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
                <span className="font-mono text-[10px] font-bold text-[#FCCC0A] uppercase tracking-[0.15em]">
                  Service Advisory
                </span>
              </div>
              <p className="font-mono text-[11px] text-[#FCCC0A]/80 leading-relaxed">
                Limited availability. This item may sell out without prior notice.
              </p>
            </div>
          )}

          {/* Size/Variation selector */}
          {product.variations.length > 1 && (
            <div className="mb-8">
              <label className="font-mono text-label text-muted uppercase tracking-[0.15em] block mb-3">
                Size
              </label>
              <div className="flex flex-wrap gap-2">
                {product.variations.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariation(v.id)}
                    className={`px-4 py-2 border font-mono text-sm transition-all ${
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
            className="turnstile-btn metrocard-gradient w-full py-5 font-display font-bold text-base tracking-[0.08em] transition-all duration-300 cursor-pointer"
          >
            <span className="relative z-10">
              {addedFeedback ? (
                <span className="text-green-600">FARE ACCEPTED &#10003;</span>
              ) : (
                "SWIPE TO ADD"
              )}
            </span>
          </button>

          {/* Trust badges */}
          <div className="mt-6 py-6">
            <WhiteBand />
            <div className="flex items-center gap-3 pt-5 flex-wrap">
              <span className="font-mono text-[9px] text-muted/70 flex items-center gap-1.5 tracking-wide uppercase">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Secure Checkout
              </span>
              <span className="text-muted/20 text-[8px]">&bull;</span>
              <span className="font-mono text-[9px] text-muted/70 flex items-center gap-1.5 tracking-wide uppercase">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                Free Ship $75+
              </span>
              <span className="text-muted/20 text-[8px]">&bull;</span>
              <span className="font-mono text-[9px] text-muted/70 flex items-center gap-1.5 tracking-wide uppercase">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
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
                  Details
                </h2>
                <div
                  className="font-body text-sm text-cream/80 leading-relaxed prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={descriptionMarkup}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related products - "NEXT TRAIN ARRIVING" */}
      {related.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 mt-28">
          <h2 className="font-mono font-bold text-sm uppercase tracking-[0.2em] text-muted mb-8">
            Next Train Arriving
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p, idx) => (
              <Link key={p.id} href={`/product/${p.slug}`} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden bg-surface">
                  {/* Track number label */}
                  <div className="absolute top-2 left-2 z-10 bg-[#141414]/90 px-2 py-0.5">
                    <span className="font-mono text-[9px] text-[#E8E4DE] tracking-[0.15em]">
                      TRACK {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                  {p.images[0] ? (
                    <Image
                      src={p.images[0]}
                      alt={p.name}
                      fill
                      className={`${
                        isPrintfulImage(p.images[0]) ? "object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]" : "object-cover"
                      } transition-transform duration-700 group-hover:scale-105`}
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-elevated" />
                  )}
                </div>
                <div className="mt-3 space-y-1">
                  <h3 className="font-body text-sm truncate group-hover:text-white transition-colors">
                    {p.name}
                  </h3>
                  <p className="font-mono text-sm text-muted">{p.priceFormatted}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
