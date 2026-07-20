import type { Metadata } from "next";
import Link from "next/link";
import { getSquareWebPaymentsConfig } from "@/lib/commerce/runtime";
import { isGiftCardsEnabled } from "@/lib/square/giftcards";
import { GiftCardPurchase } from "@/components/giftcard/GiftCardPurchase";
import { PageHeader } from "@/components/ui/PageHeader";

// noindex while the flow is gated off so the "coming soon" stub never gets
// indexed; flip to indexable when GIFT_CARDS_ENABLED ships.
export const metadata: Metadata = {
  title: "Gift Cards",
  description: "Send an After Hours Agenda digital gift card by email. Spend it on anything in the shop.",
  alternates: { canonical: "/gift-cards" },
  robots: isGiftCardsEnabled() ? undefined : { index: false, follow: true },
};

export default function GiftCardsPage() {
  const enabled = isGiftCardsEnabled();
  const config = getSquareWebPaymentsConfig();
  return (
    <main className="px-4 pb-24 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Gift cards" title="Give the after hours" description="A digital gift card, delivered by email. Spend it on anything in the made-to-order catalog." />
      {enabled ? (
        <GiftCardPurchase squareConfig={config} />
      ) : (
        <div className="border-y border-border/40 py-10">
          <p className="font-display text-2xl font-black uppercase">Coming soon</p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">Gift cards are almost ready. In the meantime, <Link href="/shop" className="text-accent underline underline-offset-4">browse the shop</Link>.</p>
        </div>
      )}
    </div></main>
  );
}
