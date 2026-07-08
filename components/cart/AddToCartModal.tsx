"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import type { CartItem, Product } from "@/lib/utils/types";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { gsap } from "@/lib/gsap";

interface AddToCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewBag: () => void;
  addedItem: CartItem | null;
  relatedProducts: Product[];
}

export function AddToCartModal({
  isOpen,
  onClose,
  onViewBag,
  addedItem,
  relatedProducts,
}: AddToCartModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Animate in when modal opens
  useEffect(() => {
    if (!isOpen || !panelRef.current || !backdropRef.current) return;

    gsap.fromTo(
      backdropRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: "power2.out" }
    );
    gsap.fromTo(
      panelRef.current,
      { opacity: 0, scale: 0.95, y: 10 },
      { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "power2.out", delay: 0.1 }
    );
  }, [isOpen]);

  // Animate out then close
  const handleClose = () => {
    if (!panelRef.current || !backdropRef.current) {
      onClose();
      return;
    }
    gsap.to(panelRef.current, {
      opacity: 0,
      scale: 0.95,
      y: 10,
      duration: 0.2,
      ease: "power2.in",
    });
    gsap.to(backdropRef.current, {
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
      onComplete: onClose,
    });
  };

  const handleViewBag = () => {
    if (!panelRef.current || !backdropRef.current) {
      onViewBag();
      return;
    }
    gsap.to(panelRef.current, {
      opacity: 0,
      scale: 0.95,
      duration: 0.2,
      ease: "power2.in",
    });
    gsap.to(backdropRef.current, {
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
      onComplete: onViewBag,
    });
  };

  if (!isOpen || !addedItem || !mounted) return null;

  // Show up to 3 related products
  const suggested = relatedProducts.slice(0, 3);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 z-[9999] bg-[#10100F]/78 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Item added to bag"
          className="zine-block max-h-[90vh] w-full max-w-[520px] overflow-y-auto pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sign-panel">
            <span className="sign-panel-text">Added to Bag</span>
            <button
              onClick={handleClose}
              className="min-h-11 border-[3px] border-[#E9E1D4] px-3 font-body text-xs font-bold uppercase text-[#E9E1D4] transition-colors hover:bg-[#E9E1D4] hover:text-[#10100F]"
              aria-label="Close"
            >
              Close
            </button>
          </div>
          <WhiteBand />

          {/* Added item */}
          <div className="px-6 py-5">
            <div className="flex gap-4 items-start">
              {addedItem.image && (
                <div className="relative w-16 h-16 bg-surface overflow-hidden flex-shrink-0 border-[3px] border-[#E9E1D4]">
                  <Image
                    src={addedItem.image}
                    alt={addedItem.name}
                    fill
                    unoptimized={isPrintfulImage(addedItem.image)}
                    className={isPrintfulImage(addedItem.image) ? "object-contain" : "object-cover xerox-image"}
                    sizes="64px"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-xl font-black uppercase leading-none tracking-[-0.04em] text-cream truncate">
                  {addedItem.name}
                </h3>
                <p className="font-body text-xs text-muted mt-1 font-bold uppercase">
                  {addedItem.variationName}
                </p>
                <p className="font-mono text-sm text-cream mt-1 font-bold">
                  {addedItem.priceFormatted}
                </p>
              </div>
              <div className="zine-sticker flex-shrink-0 bg-[#39FF14]">
                In
              </div>
            </div>
          </div>

          {/* Related products */}
          {suggested.length > 0 && (
            <>
              <WhiteBand />
              <div className="px-6 py-5">
                <p className="font-display text-2xl font-black uppercase leading-none tracking-[-0.05em] text-cream mb-4">
                  Complete the Look
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {suggested.map((product) => (
                    <Link
                      key={product.id}
                      href={`/product/${product.slug}`}
                      onClick={handleClose}
                      className="group block"
                    >
                      <div className="subway-poster-mini aspect-[3/4] bg-surface/50">
                        {product.images[0] ? (
                          <Image
                            src={product.images[0]}
                            alt={product.name}
                            fill
                            unoptimized={isPrintfulImage(product.images[0])}
                            className={`${
                              isPrintfulImage(product.images[0])
                                ? "object-contain"
                                : "object-cover xerox-image"
                            } transition-transform duration-500 group-hover:scale-105`}
                            sizes="140px"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-surface" />
                        )}

                        {/* Mini poster scrim */}
                        <div className="subway-poster-mini-scrim">
                          <h4 className="font-display font-bold text-[9px] text-[#E9E1D4] uppercase tracking-[0.04em] truncate">
                            {product.name}
                          </h4>
                          <p className="font-mono text-[10px] font-semibold text-[#CCFF00] mt-0.5">
                            {product.priceFormatted}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* CTAs */}
          <WhiteBand />
          <div className="px-6 py-5 flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-3 border-[3px] border-[#E9E1D4] font-body font-bold text-xs text-cream uppercase tracking-[0.1em] hover:bg-[#E9E1D4] hover:text-[#10100F] transition-all duration-300"
            >
              Keep Shopping
            </button>
            <button
              onClick={handleViewBag}
              className="flex-1 py-3 metrocard-gradient font-body font-bold text-xs uppercase tracking-[0.1em] transition-transform duration-300 hover:-translate-y-1"
            >
              View Bag
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
