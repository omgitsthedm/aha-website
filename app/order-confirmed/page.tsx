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
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <span className="inline-block text-4xl mb-4">✓</span>
          <h1 className="font-display font-bold text-chapter mb-4">
            Order Confirmed
          </h1>
          <p className="font-body text-muted leading-relaxed">
            Thank you for your order. Your pieces are being made just for you.
            You&apos;ll receive a confirmation email with tracking details once your
            order ships.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-sm p-8 mb-8">
          <h2 className="font-display font-bold text-sm uppercase tracking-[0.1em] mb-4">
            What Happens Next
          </h2>
          <div className="space-y-4 font-body text-sm text-cream/70 leading-relaxed text-left">
            <div className="flex gap-4">
              <span className="text-[#FCCC0A] font-mono font-bold">01</span>
              <p>Your order is sent to production. Every piece is made to order — no mass production.</p>
            </div>
            <div className="flex gap-4">
              <span className="text-[#FCCC0A] font-mono font-bold">02</span>
              <p>Production takes 2–5 business days. Quality checked before it ships.</p>
            </div>
            <div className="flex gap-4">
              <span className="text-[#FCCC0A] font-mono font-bold">03</span>
              <p>You&apos;ll get a shipping confirmation with tracking info via email.</p>
            </div>
          </div>
        </div>

        <Link
          href="/shop"
          className="metrocard-gradient inline-block px-8 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] hover:brightness-110 transition-all"
        >
          Continue Shopping &rarr;
        </Link>
      </div>
    </div>
  );
}
