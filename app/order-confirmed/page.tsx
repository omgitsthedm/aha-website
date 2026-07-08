"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";

export default function OrderConfirmedPage() {
  const { clearCart } = useCart();

  // Clear the cart after successful checkout
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="pt-28 pb-16 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <div className="zine-block zine-block-lime p-6 md:p-10 mb-8 -rotate-1">
          <span className="zine-sticker mb-5">AHA ORDER SLIP</span>
          <h1 className="font-display font-black text-chapter text-[#10100F] mb-4 misprint">
            Order Confirmed
          </h1>
          <p className="font-body text-[#10100F] leading-relaxed max-w-xl mx-auto">
            Thank you for your order. Your pieces are being made just for you.
            You&apos;ll receive a confirmation email with tracking details once your
            order ships.
          </p>
        </div>

        <div className="zine-block p-6 md:p-8 mb-8 text-left">
          <h2 className="font-display font-black text-sm uppercase tracking-[0.1em] text-neon-cyan mb-5">
            What Happens Next
          </h2>
          <div className="space-y-4 font-body text-sm text-cream leading-relaxed">
            <div className="flex gap-4">
              <span className="text-neon-lime font-mono font-bold">01</span>
              <p>Your order is sent to production. Every piece is made to order, with no mass production.</p>
            </div>
            <div className="flex gap-4">
              <span className="text-neon-lime font-mono font-bold">02</span>
              <p>Production takes 2 to 5 business days. Quality checked before it ships.</p>
            </div>
            <div className="flex gap-4">
              <span className="text-neon-lime font-mono font-bold">03</span>
              <p>You&apos;ll get a shipping confirmation with tracking info via email.</p>
            </div>
          </div>
        </div>

        <Link
          href="/shop"
          className="metrocard-gradient inline-block px-8 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] transition-all hover:-translate-y-1"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
