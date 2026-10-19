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
  initKeep();
  if (view.stage === "shipped") void loadReviews();
}

const link = () => ({ o: params.get("o")!, k: params.get("k")! });
const send = (path: string, body: unknown, header: string) => fetch(path, { method: "POST", headers: { "content-type": "application/json", [header]: "1" }, body: JSON.stringify(body) }).then(async (response) => ({ response, data: await response.json().catch(() => ({})) as { error?: string } }));

// Keep this order in the signed-in account.
function initKeep() {
  $("[data-order-keep]").hidden = false;
  const status = $("[data-order-keep-status]");
  $("[data-order-keep-button]").addEventListener("click", async () => {
    const { response, data } = await send("/api/account/orders", link(), "x-aha-account").catch(() => ({ response: null, data: {} as { error?: string } }));
    if (response?.ok) { status.textContent = "Added to your account."; return; }
    if (response?.status === 401) { status.innerHTML = 'Sign in first on <a href="/account/">your account page</a>, then open this link again.'; return; }
    status.textContent = data.error ?? "That didn’t work. Try again in a minute.";
  });
}

type Reviewable = { open: boolean; products: Array<{ slug: string; title: string; color: string; review: { rating: number; body: string; name: string | null; status: string } | null }> };
async function loadReviews() {
  const response = await fetch(`/api/reviews/order?${new URLSearchParams(link())}`).catch(() => null);
  const data = response?.ok ? await response.json() as Reviewable : null;
  if (!data?.open || !data.products.length) return;
  const template = $<HTMLTemplateElement>("[data-review-template]");
  $("[data-review-forms]").replaceChildren(...data.products.map((product, index) => {
    const form = (template.content.cloneNode(true) as DocumentFragment).querySelector("form")!;
    form.querySelector("h3")!.textContent = `${product.title} — ${product.color}`;
    form.querySelectorAll<HTMLInputElement>("input[name=rating]").forEach((input) => { input.name = `rating-${index}`; input.checked = Number(input.value) === product.review?.rating; });
    const body = form.querySelector("textarea")!;
    const name = form.querySelector<HTMLInputElement>("input[name=name]")!;
    const status = form.querySelector(".review-status")!;
    body.value = product.review?.body ?? "";
    name.value = product.review?.name ?? "";
    if (product.review) status.textContent = product.review.status === "approved" ? "Your review is on the product page. Editing it sends it back for a read." : "Thanks. Your review appears once we’ve read it.";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const rating = form.querySelector<HTMLInputElement>(`input[name=rating-${index}]:checked`)?.value;
      if (!rating || body.value.trim().length < 2) { status.textContent = "Choose a rating and write a few words."; return; }
      const { response: result, data: reply } = await send("/api/reviews/order", { ...link(), product: product.slug, rating: Number(rating), body: body.value, name: name.value }, "x-aha-review").catch(() => ({ response: null, data: {} as { error?: string } }));
      status.textContent = result?.ok ? "Thanks. Your review appears once we’ve read it." : reply.error ?? "That didn’t send. Try again in a minute.";
    });
    return form;
  }));
  $("[data-order-reviews]").hidden = false;
  // The review-request email links here.
  if (location.hash === "#leave-a-review") $("[data-order-reviews]").scrollIntoView();
}
void load();
