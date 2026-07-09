"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { PRODUCTION_WINDOW, DELIVERY_WINDOW } from "@/lib/commerce/policies";

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
              <p>Production takes {PRODUCTION_WINDOW}. Quality checked before it ships.</p>
            </div>
            <div className="flex gap-4">
              <span className="text-neon-lime font-mono font-bold">03</span>
              <p>Delivery is {DELIVERY_WINDOW}. You&apos;ll get tracking by email when it ships.</p>
            </div>
          </div>
        </div>

        <div className="zine-block mb-8 p-5 text-left">
          <h2 className="mb-3 font-display text-sm font-black uppercase tracking-[0.1em] text-neon-cyan">
            Need the receipt?
          </h2>
          <p className="font-body text-sm font-bold leading-relaxed text-cream/80">
            Square sends the order receipt to the email used at checkout. If it
            does not arrive, contact{" "}
            <a
              href="mailto:hello@afterhoursagenda.com"
              className="text-neon-lime underline underline-offset-4"
            >
              hello@afterhoursagenda.com
            </a>
            .
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/shop"
            className="metrocard-gradient inline-block min-h-11 px-8 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] transition-all hover:-translate-y-1"
          >
            Continue Shopping
          </Link>
          <Link
            href="/shipping"
            className="inline-block min-h-11 border-[3px] border-[#E9E1D4] px-8 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] text-[#E9E1D4] underline underline-offset-4 transition-all hover:bg-[#E9E1D4] hover:text-[#10100F]"
          >
            Shipping Details
          </Link>
        </div>
      </div>
    </div>
  );
}
