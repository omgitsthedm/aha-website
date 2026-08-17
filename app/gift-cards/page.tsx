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
  description: "After Hours Agenda gift cards are paused while the next collection is developed.",
  alternates: { canonical: "/gift-cards" },
  robots: isGiftCardsEnabled() ? undefined : { index: false, follow: true },
};

export default function GiftCardsPage() {
  const enabled = isGiftCardsEnabled();
  const config = getSquareWebPaymentsConfig();
  return (
    <main className="px-4 pb-24 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Gift cards" title="Paused for the reset" description={enabled ? "A digital gift card, delivered by email." : "Gift-card purchases are unavailable while the prior collection is archived and the next release is developed."} />
      {enabled ? (
        <GiftCardPurchase squareConfig={config} />
      ) : (
        <div className="border-y border-border/40 py-10">
          <p className="font-display text-2xl font-black uppercase">Unavailable during the reset</p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">No gift-card purchase can be started right now. <Link href="/#dispatch-heading" className="text-accent underline underline-offset-4">Get the next release update</Link>.</p>
        </div>
      )}
    </div></main>
  );
}
