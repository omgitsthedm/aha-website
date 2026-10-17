// The private order page: reads the signed link, asks /api/orders/status and shows
// where the order is, with an estimated arrival until it ships.
import { arrivalWindow, formatDay } from "./delivery";

type View = { orderNumber: string; stage: "paid" | "production" | "shipped" | "review"; paidAt: string | null; items: Array<{ title: string; size: string | null; quantity: number }>; tracking: Array<{ carrier: string | null; number: string | null; url: string | null }> };
const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const note = $("[data-order-note]");

async function load() {
  if (!params.get("o") || !params.get("k")) return;
  $("[data-order-lede]").textContent = "Checking your order…";
  let view: View;
  try {
    const response = await fetch(`/api/orders/status?${new URLSearchParams({ o: params.get("o")!, k: params.get("k")! })}`, { headers: { accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { $("[data-order-lede]").textContent = (data as { error?: string }).error ?? "We couldn't load this order. Try again in a minute."; return; }
    view = data as View;
  } catch { $("[data-order-lede]").textContent = "We couldn't load this order. Try again in a minute."; return; }
  $("[data-order-title]").textContent = `Order ${view.orderNumber}`;
  const paid = view.paidAt ? new Date(view.paidAt) : null;
  $("[data-order-lede]").textContent = paid ? `Placed ${formatDay(paid)}.` : "Payment received.";
  const order = ["paid", "production", "shipped"];
  const reached = view.stage === "review" ? 0 : order.indexOf(view.stage);
  document.querySelectorAll<HTMLElement>("[data-step]").forEach((step, index) => { step.classList.toggle("is-done", index <= reached); step.toggleAttribute("aria-current", index === reached); });
  $("[data-order-steps]").hidden = false;
  if (view.stage === "review") note.textContent = "We're checking a detail on your order before production. We'll email you if we need anything.";
  else if (view.stage !== "shipped" && paid) { const { shipsBy, latest } = arrivalWindow(paid); note.textContent = `Estimated to ship by ${formatDay(shipsBy)} and arrive in the U.S. by ${formatDay(latest)}.`; }
  else if (view.stage === "shipped") note.textContent = "Your order has shipped. Carrier scans can take a day to appear.";
  if (view.tracking.length) {
    const box = $("[data-order-tracking]");
    box.replaceChildren(...view.tracking.map((entry) => entry.url ? Object.assign(document.createElement("a"), { href: entry.url, target: "_blank", rel: "noopener noreferrer", className: "button", textContent: `Track with ${entry.carrier ?? "the carrier"}` }) : Object.assign(document.createElement("p"), { textContent: `${entry.carrier ?? "Tracking"} ${entry.number ?? ""}` })));
    box.hidden = false;
  }
  if (view.items.length) {
    const list = $("[data-order-items]");
    list.replaceChildren(...view.items.map((item) => Object.assign(document.createElement("li"), { textContent: `${item.quantity} × ${item.title}${item.size ? ` · ${item.size}` : ""}` })));
    list.hidden = false;
  }
}
void load();
