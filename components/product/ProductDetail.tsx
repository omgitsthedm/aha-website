"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product, Collection } from "@/lib/utils/types";
import { useCart } from "@/components/cart/CartProvider";

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

  const currentVariation = product.variations.find(
    (v) => v.id === selectedVariation
  );

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

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  };

  return (
    <div className="pt-20 pb-16">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <nav className="font-mono text-xs text-muted">
          <Link href="/shop" className="hover:text-cream transition-colors">
            Shop
          </Link>
          {collection && (
            <>
              <span className="mx-2">/</span>
              <Link
                href={`/collections/${collection.slug}`}
                className="hover:text-cream transition-colors"
              >
                {collection.name}
              </Link>
            </>
          )}
          <span className="mx-2">/</span>
          <span className="text-cream">{product.name}</span>
        </nav>
      </div>

      {/* Product hero */}
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
        {/* Images */}
        <div className="space-y-4">
          <div className="relative aspect-[3/4] overflow-hidden bg-surface rounded-sm">
            {product.images[activeImage] ? (
              <Image
                src={product.images[activeImage]}
                alt={product.name}
                fill
                className="object-cover"
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
                  className={`relative w-16 h-16 overflow-hidden rounded-sm border transition-all ${
                    i === activeImage
                      ? "border-glow"
                      : "border-border hover:border-muted"
                  }`}
                >
                  <Image
                    src={img}
                    alt={`${product.name} view ${i + 1}`}
                    fill
                    className="object-cover"
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
            <span className="font-mono text-label text-glow uppercase tracking-[0.2em] block mb-3">
              {collection.name}
            </span>
          )}

          <h1 className="font-display font-bold text-3xl md:text-4xl mb-4">
            {product.name}
          </h1>

          <p className="font-mono text-2xl text-cream mb-6">
            {currentVariation?.priceFormatted || product.priceFormatted}
          </p>

          {/* Size/Variation selector */}
          {product.variations.length > 1 && (
            <div className="mb-6">
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
                        ? "border-cream bg-cream text-void"
                        : "border-border text-muted hover:border-cream hover:text-cream"
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add to cart */}
          <button
            onClick={handleAddToCart}
            className={`w-full py-4 font-display font-bold text-sm tracking-wide transition-all duration-300 ${
              addedFeedback
                ? "bg-glow text-void"
                : "bg-cream text-void hover:bg-glow"
            }`}
          >
            {addedFeedback ? "✓ ADDED TO BAG" : "ADD TO BAG"}
          </button>

          {/* Trust badges */}
          <div className="flex items-center gap-4 mt-4 py-3 border-t border-border">
            <span className="font-mono text-[10px] text-muted">🔒 Secure Checkout</span>
            <span className="font-mono text-[10px] text-muted">📦 Free Ship $75+</span>
            <span className="font-mono text-[10px] text-muted">🖨️ Made to Order</span>
          </div>

          {/* Description */}
          {product.description && (
            <div className="mt-8 pt-6 border-t border-border">
              <h2 className="font-display font-bold text-sm mb-4 text-muted uppercase tracking-wide">
                Details
              </h2>
              <div
                className="font-body text-sm text-cream/80 leading-relaxed prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 mt-24">
          <h2 className="font-display font-bold text-2xl mb-8">
            You might also like
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p) => (
              <Link key={p.id} href={`/product/${p.slug}`} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden bg-surface rounded-sm">
                  {p.images[0] ? (
                    <Image
                      src={p.images[0]}
                      alt={p.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-elevated" />
                  )}
                </div>
                <div className="mt-3 space-y-1">
                  <h3 className="font-body text-sm truncate group-hover:text-glow transition-colors">
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
