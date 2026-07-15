import { randomUUID } from "node:crypto";
import { squareRequest } from "@/lib/square/client";
import { getSquareLocationId } from "@/lib/commerce/runtime";

// Square Gift Cards. SELL = create an order for the amount → charge the buyer's
// card → create + activate a DIGITAL gift card → email the code. REDEEM is not
// here: a gift card is just a payment source, so the normal /payments charge in
// create-payment handles it (the SDK's giftCard() field produces the source_id).
//
// Everything here is gated by GIFT_CARDS_ENABLED and unverified until a real
// $1 buy-test — Square's activation params can only be confirmed live.

export function isGiftCardsEnabled(): boolean {
  return process.env.GIFT_CARDS_ENABLED === "true";
}

interface GiftCard { id: string; gan: string; state?: string; balance_money?: { amount: number; currency: string } }

/** Create a paid order for the gift-card amount so activation can reference it. */
async function createGiftCardOrder(amount: number, currency: string): Promise<{ orderId: string; lineItemUid: string }> {
  const res = await squareRequest<{ order: { id: string; line_items: Array<{ uid: string }> } }>("/orders", {
    method: "POST", revalidate: 0,
    body: {
      idempotency_key: randomUUID(),
      order: {
        location_id: getSquareLocationId(),
        line_items: [{
          name: "After Hours Agenda gift card",
          quantity: "1",
          item_type: "GIFT_CARD",
          base_price_money: { amount, currency },
        }],
      },
    },
  });
  return { orderId: res.order.id, lineItemUid: res.order.line_items[0].uid };
}

async function chargeForGiftCard(sourceId: string, amount: number, currency: string, orderId: string, email: string): Promise<string> {
  const res = await squareRequest<{ payment: { id: string; status: string } }>("/payments", {
    method: "POST", revalidate: 0,
    body: {
      source_id: sourceId,
      idempotency_key: randomUUID(),
      order_id: orderId,
      amount_money: { amount, currency },
      location_id: getSquareLocationId(),
      buyer_email_address: email,
      note: "After Hours Agenda gift card",
      autocomplete: true,
    },
  });
  if (res.payment.status !== "COMPLETED" && res.payment.status !== "APPROVED") {
    throw new Error(`gift-card payment status ${res.payment.status}`);
  }
  return res.payment.id;
}

async function createDigitalGiftCard(): Promise<GiftCard> {
  const res = await squareRequest<{ gift_card: GiftCard }>("/gift-cards", {
    method: "POST", revalidate: 0,
    body: { idempotency_key: randomUUID(), location_id: getSquareLocationId(), gift_card: { type: "DIGITAL" } },
  });
  return res.gift_card;
}

async function activateGiftCard(giftCardId: string, amount: number, currency: string, orderId: string, lineItemUid: string): Promise<void> {
  await squareRequest("/gift-cards/activities", {
    method: "POST", revalidate: 0,
    body: {
      idempotency_key: randomUUID(),
      gift_card_activity: {
        type: "ACTIVATE",
        location_id: getSquareLocationId(),
        gift_card_id: giftCardId,
        activate_activity_details: { amount_money: { amount, currency }, order_id: orderId, line_item_uid: lineItemUid },
      },
    },
  });
}

/** Full purchase orchestration. Returns the gift-card number (GAN) to email. */
export async function purchaseGiftCard(input: { sourceId: string; amount: number; currency?: string; buyerEmail: string }): Promise<{ gan: string; giftCardId: string }> {
  const currency = input.currency || "USD";
  const { orderId, lineItemUid } = await createGiftCardOrder(input.amount, currency);
  await chargeForGiftCard(input.sourceId, input.amount, currency, orderId, input.buyerEmail);
  const card = await createDigitalGiftCard();
  await activateGiftCard(card.id, input.amount, currency, orderId, lineItemUid);
  return { gan: card.gan, giftCardId: card.id };
}

/** Look up a gift card's live balance by its number (for a redeem-balance check). */
export async function getGiftCardBalance(gan: string): Promise<{ amount: number; currency: string } | null> {
  try {
    const res = await squareRequest<{ gift_card: GiftCard }>("/gift-cards/from-gan", {
      method: "POST", revalidate: 0, body: { gan },
    });
    return res.gift_card.balance_money ?? { amount: 0, currency: "USD" };
  } catch {
    return null;
  }
}
