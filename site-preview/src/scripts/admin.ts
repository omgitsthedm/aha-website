import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

type Json = Record<string, unknown>;
type Draft = { id: string; status: string; design_slug: string | null; approved_by: string | null; error: string | null; updated_at: string; payload_json: { name?: string; title?: string; color?: string; priceCents?: number; description?: string | null; storeDescription?: string; imageUrls?: string[]; sizes?: string[]; apliiqDesignId?: number; variants?: Array<{ size: string; sku: string; supplierPriceCents: number }> } };
type Order = { squareOrderId: string; state: string; apliiqOrderId: string | null; customer: string | null; totalCents: number | null; items: Array<{ title: string; size: string | null; quantity: number }>; tracking: Array<{ carrier: string | null; number: string | null; url: string | null }>; createdAt: string; flags: Array<{ code: string; message: string }> };

const page = document.body.dataset.adminPage;
const status = document.querySelector<HTMLElement>("[data-admin-status]");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: Array<Node | string | null>): HTMLElementTagNameMap[K] {
  const node: HTMLElementTagNameMap[K] = Object.assign(document.createElement(tag), props);
  for (const child of children) if (child !== null) node.append(child);
  return node;
}

async function api<T = Json>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, { ...init, credentials: "same-origin", headers: { "content-type": "application/json", "x-aha-admin": "1", ...(init.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { showSignIn(); throw new Error((data as Json).error as string ?? "Sign in required."); }
  if (!response.ok) throw new Error(((data as Json).error as string) ?? "Something went wrong.");
  return data as T;
}
const post = <T = Json>(path: string, body: Json = {}) => api<T>(path, { method: "POST", body: JSON.stringify(body) });

function say(message: string) { if (status) status.textContent = message; }
function showSignIn() {
  document.querySelector<HTMLElement>("[data-admin-signin]")!.hidden = false;
  document.querySelector<HTMLElement>("[data-admin-content]")!.hidden = true;
  document.querySelector<HTMLElement>("[data-admin-nav]")!.hidden = true;
}
function showContent() {
  document.querySelector<HTMLElement>("[data-admin-signin]")!.hidden = true;
  document.querySelector<HTMLElement>("[data-admin-content]")!.hidden = false;
  document.querySelector<HTMLElement>("[data-admin-nav]")!.hidden = false;
}

// The browser reports a closed, timed-out or blocked passkey prompt as NotAllowedError
// with a spec link; say what to do instead.
function passkeyMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.name === "NotAllowedError") {
    return "The passkey prompt was closed, timed out or blocked. Try again in a regular Chrome or Safari window (not one controlled by an automation extension) and finish the Touch ID, phone or security-key step within four minutes.";
  }
  return error instanceof Error ? error.message : fallback;
}

document.querySelector("[data-admin-login]")?.addEventListener("click", async () => {
  try {
    say("Waiting for your passkey…");
    const { options, handle } = await post<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"]; handle: string }>("auth/login/options");
    const response = await startAuthentication({ optionsJSON: options });
    await post("auth/login/verify", { handle, response });
    say("Signed in.");
    await load();
  } catch (error) { say(passkeyMessage(error, "Sign-in failed.")); }
});

document.querySelector<HTMLFormElement>("[data-admin-setup]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  try {
    say("Creating your passkey…");
    const { options, handle } = await post<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"]; handle: string }>("auth/register/options", { email: String(form.get("email") ?? ""), bootstrapToken: String(form.get("bootstrapToken") ?? "") });
    const response = await startRegistration({ optionsJSON: options });
    await post("auth/register/verify", { handle, response });
    say("Passkey saved. You're signed in.");
    await load();
  } catch (error) { say(passkeyMessage(error, "Setup failed.")); }
});

document.querySelector("[data-admin-signout]")?.addEventListener("click", async () => {
  await post("auth/logout").catch(() => null);
  showSignIn();
  say("Signed out.");
});

function card(value: number | string, label: string, href?: string, alert = false) {
  const body = [el("strong", { textContent: String(value) }), el("span", { textContent: label })];
  const node = href ? el("a", { href, className: `admin-card${alert ? " is-alert" : ""}` }) : el("div", { className: `admin-card${alert ? " is-alert" : ""}` });
  node.append(...body);
  return node;
}

async function renderOverview() {
  type Report = { ok: boolean; createdAt: string; summary: { problems?: string[] } };
  const [me, data] = await Promise.all([api<{ email: string }>("me"), api<{ ordersToday: number; ordersThisWeek: number; ordersNeedingAttention: number; draftsWaiting: number; draftsApproved: number; reports?: { daily_health?: Report; weekly_digest?: Report } }>("overview")]);
  const target = document.querySelector("[data-admin-overview]")!;
  target.replaceChildren(
    card(data.ordersToday, "Orders today", "/admin/orders/"),
    card(data.ordersThisWeek, "Orders this week", "/admin/orders/"),
    card(data.ordersNeedingAttention, "Orders needing attention", "/admin/orders/", data.ordersNeedingAttention > 0),
    card(data.draftsWaiting, "Drafts waiting for you", "/admin/products/", data.draftsWaiting > 0),
    card(data.draftsApproved, "Approved, not yet published", "/admin/products/"),
  );
  const health = data.reports?.daily_health;
  const problems = health?.summary?.problems ?? [];
  const checked = health ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(health.createdAt)) : null;
  document.querySelector("[data-admin-health]")!.replaceChildren(
    el("h2", { textContent: "Daily check" }),
    el("p", { className: "admin-meta", textContent: health ? `${health.ok ? "Everything matches" : `${problems.length} thing${problems.length === 1 ? "" : "s"} need a look`} · checked ${checked}` : "The first daily check runs at 9:00 New York time." }),
    ...(problems.length ? [el("ul", { className: "admin-list" }, ...problems.slice(0, 20).map((problem) => el("li", { textContent: problem })))] : []),
  );
  document.querySelector("[data-admin-whoami]")!.textContent = `Signed in as ${me.email}`;
}

let orderFilter = "all";
async function renderOrders() {
  const { orders } = await api<{ orders: Order[] }>("orders");
  const list = document.querySelector("[data-admin-orders]")!;
  const shown = orderFilter === "attention" ? orders.filter((order) => order.flags.length) : orders;
  if (!shown.length) { list.replaceChildren(el("p", { className: "admin-empty", textContent: orderFilter === "attention" ? "Nothing needs attention." : "No paid orders yet." })); return; }
  list.replaceChildren(...shown.map((order) => {
    const shipped = order.state === "shipped";
    const header = el("header", {}, el("h3", { textContent: order.items.map((item) => `${item.quantity} × ${item.title}${item.size ? ` (${item.size})` : ""}`).join(", ") || "Order" }), el("span", { className: `admin-pill ${shipped ? "is-good" : order.flags.length ? "is-alert" : ""}`, textContent: order.state.replace(/_/g, " ") }));
    const meta = el("p", { className: "admin-meta" }, el("span", { textContent: when.format(new Date(order.createdAt)) }), el("span", { textContent: order.customer ?? "" }), el("span", { textContent: order.totalCents === null ? "" : money.format(order.totalCents / 100) }), el("span", { textContent: `Square ${order.squareOrderId}` }), el("span", { textContent: order.apliiqOrderId ? `Apliiq ${order.apliiqOrderId}` : "Not yet in Apliiq" }));
    const tracking = order.tracking.map((entry) => entry.url ? el("a", { href: entry.url, target: "_blank", rel: "noopener noreferrer", textContent: `${entry.carrier ?? "Tracking"} ${entry.number ?? ""}` }) : el("span", { textContent: `${entry.carrier ?? ""} ${entry.number ?? ""}` }));
    const flags = order.flags.map((flag) => el("p", { className: "admin-flag", textContent: flag.message }));
    return el("article", { className: "admin-row" }, header, meta, ...(tracking.length ? [el("p", { className: "admin-meta" }, ...tracking)] : []), ...flags);
  }));
}

let draftFilter = "draft";
async function renderDrafts() {
  const { drafts } = await api<{ drafts: Draft[] }>(`drafts?status=${encodeURIComponent(draftFilter)}`);
  const list = document.querySelector("[data-admin-drafts]")!;
  if (!drafts.length) { list.replaceChildren(el("p", { className: "admin-empty", textContent: draftFilter === "draft" ? "No drafts waiting. In Apliiq, open a saved design and press Add to Store." : "Nothing here yet." })); return; }
  list.replaceChildren(...drafts.map((draft) => {
    const data = draft.payload_json;
    const title = data.title ?? data.name ?? "Untitled design";
    const supplier = Math.max(...(data.variants ?? []).map((variant) => variant.supplierPriceCents), 0);
    const thumbs = el("div", { className: "admin-thumbs" }, ...(data.imageUrls ?? []).slice(0, 6).map((src) => el("img", { src, alt: "", loading: "lazy", referrerPolicy: "no-referrer" })));
    const meta = el("p", { className: "admin-meta" }, el("span", { textContent: `Apliiq design ${data.apliiqDesignId ?? "?"}` }), el("span", { textContent: (data.sizes ?? []).join(" · ") }), el("span", { textContent: supplier ? `Supplier up to ${money.format(supplier / 100)}` : "" }), el("span", { textContent: data.priceCents ? `Retail ${money.format(data.priceCents / 100)}` : "Retail not set" }));
    const actions = el("div", { className: "admin-actions" });
    if (draft.status === "draft") {
      const form = el("form", {}, el("label", {}, "Title", el("input", { name: "title", value: title, required: true })), el("label", {}, "Color", el("input", { name: "color", value: data.color ?? "" })), el("label", {}, "Retail price (USD)", el("input", { name: "price", type: "number", min: "1", step: "1", value: data.priceCents ? String(data.priceCents / 100) : "" })), el("label", {}, "Slug", el("input", { name: "slug", value: draft.design_slug ?? "", placeholder: "pet-it-be-ss3000-cranberry", pattern: "[a-z0-9-]+" })), el("label", {}, "Garment", (() => { const select = el("select", { name: "blank", required: true }); for (const [value, label] of [["", "Choose the blank"], ["SS3000", "Independent SS3000 crewneck"], ["SS4500", "Independent SS4500 hoodie"], ["AFX64CRP", "Independent AFX64CRP cropped hoodie"], ["NL3601", "Next Level 3601 long sleeve"], ["CC4410", "Comfort Colors 4410 pocket long sleeve"]]) select.append(el("option", { value, textContent: label, selected: (data as { blank?: string }).blank === value })); return select; })()), el("label", {}, "Collection", el("input", { name: "collection", value: (data as { collection?: string }).collection ?? "", placeholder: "Pet It Be" })),  el("button", { type: "submit", className: "admin-secondary", textContent: "Save details" }));
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = new FormData(form);
        const price = Number(values.get("price"));
        try { await api(`drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify({ title: String(values.get("title")), ...(values.get("color") ? { color: String(values.get("color")) } : {}), ...(price ? { priceCents: Math.round(price * 100) } : {}), ...(values.get("slug") ? { designSlug: String(values.get("slug")) } : {}), ...(values.get("blank") ? { blank: String(values.get("blank")) } : {}), ...(values.get("collection") ? { collection: String(values.get("collection")) } : {}) }) }); say("Saved."); await renderDrafts(); } catch (error) { say((error as Error).message); }
      });
      const approve = el("button", { type: "button", className: "admin-primary", textContent: "Approve" });
      approve.addEventListener("click", async () => { try { await post(`drafts/${draft.id}/approve`); await renderDrafts(); } catch (error) { say((error as Error).message); } });
      const reject = el("button", { type: "button", className: "admin-secondary admin-danger", textContent: "Reject" });
      reject.addEventListener("click", async () => { const reason = prompt("Why reject this design?"); if (!reason) return; try { await post(`drafts/${draft.id}/reject`, { reason }); await renderDrafts(); } catch (error) { say((error as Error).message); } });
      actions.append(approve, reject);
      return el("article", { className: "admin-row" }, el("header", {}, el("h3", { textContent: title }), el("span", { className: "admin-pill", textContent: "Waiting" })), thumbs, meta, form, actions);
    }
    if (draft.status === "approved") {
      const publish = el("button", { type: "button", className: "admin-primary", textContent: "Publish" });
      publish.addEventListener("click", async () => { try { await post(`drafts/${draft.id}/publish`); say("Publish requested. The catalog engine will create the Square item and site listing."); } catch (error) { say((error as Error).message); } });
      actions.append(publish);
    }
    return el("article", { className: "admin-row" }, el("header", {}, el("h3", { textContent: title }), el("span", { className: `admin-pill ${draft.status === "published" ? "is-good" : draft.status === "rejected" ? "is-alert" : ""}`, textContent: draft.status })), thumbs, meta, ...(draft.error ? [el("p", { className: "admin-flag", textContent: draft.error })] : []), actions);
  }));
}

async function renderAnalytics() {
  const data = await api<{ abandonedCarts: { last7Days: { carts: number; completed: number; abandoned: number }; last30Days: { carts: number; completed: number; abandoned: number }; recent: Array<{ checkoutId: string; createdAt: string; totalCents: number; posthogSessionId: string | null }> }; posthogProjectUrl: string | null }>("analytics");
  const { last7Days: week, last30Days: month, recent } = data.abandonedCarts;
  const rate = (row: { carts: number; completed: number }) => row.carts ? `${Math.round((row.completed / row.carts) * 100)}%` : "–";
  document.querySelector("[data-admin-carts]")!.replaceChildren(card(week.abandoned, "Abandoned carts, 7 days", undefined, week.abandoned > 0), card(rate(week), "Checkout completion, 7 days"), card(month.abandoned, "Abandoned carts, 30 days"), card(rate(month), "Checkout completion, 30 days"));
  const replay = (id: string | null) => (id && data.posthogProjectUrl ? el("a", { href: `${data.posthogProjectUrl.replace(/\/$/, "")}/replay/${encodeURIComponent(id)}`, target: "_blank", rel: "noopener noreferrer", textContent: "Watch recording" }) : el("span", { textContent: id ? "Recording may exist in PostHog" : "No recording for this visit" }));
  document.querySelector("[data-admin-cart-list]")!.replaceChildren(...(recent.length ? recent.map((cart) => el("article", { className: "admin-row" }, el("p", { className: "admin-meta" }, el("span", { textContent: when.format(new Date(cart.createdAt)) }), el("span", { textContent: money.format(cart.totalCents / 100) }), replay(cart.posthogSessionId)))) : [el("p", { className: "admin-empty", textContent: "No abandoned carts in the last 30 days." })]));
  const link = document.querySelector("[data-admin-posthog]")!;
  link.replaceChildren(data.posthogProjectUrl ? el("a", { className: "admin-primary", href: data.posthogProjectUrl, target: "_blank", rel: "noopener noreferrer", textContent: "Open PostHog: trends, heatmaps and recordings" }) : el("span", { className: "admin-meta", textContent: "PostHog isn't connected yet." }));
}

document.querySelectorAll<HTMLButtonElement>("[data-order-filter]").forEach((button) => button.addEventListener("click", async () => {
  orderFilter = button.dataset.orderFilter ?? "all";
  document.querySelectorAll<HTMLButtonElement>("[data-order-filter]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  await renderOrders().catch((error) => say((error as Error).message));
}));
document.querySelectorAll<HTMLButtonElement>("[data-draft-filter]").forEach((button) => button.addEventListener("click", async () => {
  draftFilter = button.dataset.draftFilter ?? "draft";
  document.querySelectorAll<HTMLButtonElement>("[data-draft-filter]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  await renderDrafts().catch((error) => say((error as Error).message));
}));

async function load() {
  try {
    await api("me");
    showContent();
    if (page === "overview") await renderOverview();
    if (page === "orders") await renderOrders();
    if (page === "products") await renderDrafts();
    if (page === "analytics") await renderAnalytics();
  } catch (error) {
    // Sign-in is the safe fallback for any failure, with the reason shown.
    showSignIn();
    if (!(error instanceof Error) || error.message !== "Sign in required.") say(error instanceof Error ? `Admin unavailable: ${error.message}` : "Admin unavailable.");
  }
}

void load();
