import { cleanBag } from "./store";
import type { Piece } from "../data/catalog";
interface Quote {
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  shipping?: number;
}
type Card = {
  attach: (selector: string) => Promise<void>;
  tokenize: (details: unknown) => Promise<{ status: string; token?: string }>;
  destroy: () => Promise<void>;
};
type Square = {
  payments: (app: string, location: string) => { card: () => Promise<Card> };
};
const form = document.querySelector<HTMLFormElement>("#checkout-form")!;
const state = document.getElementById("checkout-state")!;
const status = document.getElementById("payment-status")!;
const review = document.getElementById("checkout-review")!;
const fields = document.querySelector<HTMLFieldSetElement>("#shipping-fields")!;
const pieces: Piece[] = JSON.parse(
  document.getElementById("shopping-data")?.textContent || "[]",
);
let lines: { squareVariationId: string; quantity: number }[] = [];
let quote: Quote | null = null;
let contact: Record<string, unknown> = {};
let card: Card | null = null;
let attempt = crypto.randomUUID();
let uncertain = false;
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: quote?.currency || "USD",
  }).format(value / 100);
async function post(path: string, data: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  return { response, result };
}
async function setup() {
  try {
    let stored;
    try {
      stored = JSON.parse(localStorage.getItem("aha:bag:v2") || "[]");
    } catch {
      stored = [];
    }
    const bag = cleanBag(stored, pieces);
    lines = bag.map((line) => ({
      squareVariationId: pieces
        .flatMap((p) => p.variants)
        .find((v) => v.id === line.id)!.squareVariationId,
      quantity: line.quantity,
    }));
    const response = await fetch("/api/commerce");
    const config = await response.json();
    if (!response.ok || !config.ready || !lines.length) {
      state.textContent = !lines.length
        ? "Your bag is empty. New orders are currently paused."
        : config.reason || "Checkout is temporarily unavailable.";
      return;
    }
    if (config.sdkUrl !== "https://web.squarecdn.com/v1/square.js")
      throw new Error("Payment configuration is unavailable.");
    state.textContent =
      "Enter your shipping details. You will review shipping, tax and the final total before payment.";
    form.hidden = false;
    document.getElementById("checkout-closed")!.hidden = true;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = config.sdkUrl;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Secure payment could not load. Please try again."));
      document.head.append(script);
    });
    const square = (window as unknown as { Square: Square }).Square;
    card = await square
      .payments(config.applicationId, config.locationId)
      .card();
  } catch (error) {
    state.textContent =
      error instanceof Error
        ? error.message
        : "Checkout is temporarily unavailable.";
  }
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  )!;
  if (button.disabled) return;
  button.disabled = true;
  status.textContent = "Checking the final total…";
  try {
    const data = Object.fromEntries(new FormData(form));
    contact = {
      email: data.email,
      shippingName: data.name,
      shippingAddress: {
        address1: data.address1,
        address2: data.address2,
        city: data.city,
        state: data.state,
        zip: data.zip,
        country: data.country,
      },
    };
    const { response, result } = await post("/api/checkout-quote", {
      lines,
      contact,
    });
    if (!response.ok)
      throw new Error(result.error || "The total could not be calculated.");
    quote = result.quote;
    fields.disabled = true;
    review.hidden = false;
    if (card && !document.querySelector("#card-container iframe"))
      await card.attach("#card-container");
    document.getElementById("quote-lines")!.textContent =
      "Products " +
      money(quote!.subtotal) +
      " · Shipping " +
      money(quote!.shipping || 0) +
      " · Tax " +
      money(quote!.tax);
    document.getElementById("quote-total")!.textContent =
      "Total " + money(quote!.total);
    status.textContent = "Review the total before paying.";
    document.dispatchEvent(
      new CustomEvent("aha:conversion", { detail: "begin_checkout" }),
    );
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : "Unable to calculate the total.";
  } finally {
    button.disabled = false;
    status.focus();
  }
});
document.getElementById("edit-shipping")!.addEventListener("click", () => {
  if (uncertain) {
    status.textContent =
      "Payment confirmation is pending. Keep this order unchanged and contact support.";
    return;
  }
  fields.disabled = false;
  review.hidden = true;
  quote = null;
  attempt = crypto.randomUUID();
  document.getElementById("checkout-name")!.focus();
});
document.getElementById("pay-button")!.addEventListener("click", async () => {
  const button = document.querySelector<HTMLButtonElement>("#pay-button")!;
  if (button.disabled || !quote || !card) return;
  if (!document.querySelector<HTMLInputElement>("#accept-order")!.checked) {
    status.textContent = "Confirm that you reviewed the total and terms.";
    status.focus();
    return;
  }
  button.disabled = true;
  status.textContent = "Confirming your payment…";
  try {
    const token = await card.tokenize({
      amount: (quote.total / 100).toFixed(2),
      currencyCode: quote.currency,
      intent: "CHARGE",
      customerInitiated: true,
      sellerKeyedIn: false,
      billingContact: { email: contact.email },
    });
    if (token.status !== "OK" || !token.token)
      throw new Error("Check the payment details and try again.");
    uncertain = true;
    const { response, result } = await post("/api/create-payment", {
      sourceId: token.token,
      idempotencyKey: attempt,
      quotedTotal: quote.total,
      quotedCurrency: quote.currency,
      lines,
      contact,
    });
    if (!response.ok) {
      if (result.declined === true) {
        uncertain = false;
        attempt = crypto.randomUUID();
      }
      if (result.code === "QUOTE_CHANGED") {
        uncertain = false;
        quote = null;
        review.hidden = true;
        fields.disabled = false;
      }
      throw new Error(
        result.error ||
          "Payment confirmation is pending. Keep this page open and contact support.",
      );
    }
    if (result.pending) {
      status.textContent =
        "Your payment is awaiting confirmation. Order " +
        result.orderNumber +
        ". Do not start another checkout.";
      return;
    }
    uncertain = false;
    try {
      localStorage.removeItem("aha:bag:v2");
    } catch {}
    form.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = "Thank you. Order " + result.orderNumber;
    const info = document.createElement("p");
    info.textContent =
      "Your order has been received. Keep the order number for tracking and support.";
    const link = document.createElement("a");
    link.href = "/track-order/";
    link.className = "button";
    link.textContent = "Track your order";
    form.append(heading, info, link);
  } catch (error) {
    status.textContent =
      error instanceof Error
        ? error.message
        : "We could not confirm payment. Keep this page open and contact support.";
    if (uncertain)
      status.textContent +=
        " Your payment may have gone through. Do not start a new checkout.";
    status.focus();
  } finally {
    button.disabled = uncertain;
  }
});
void setup();
