// The account page: passkey sign-in (no library; the server verifies with
// @simplewebauthn/server), saved pieces, orders and account deletion.
import { catalogState } from "./catalog-state";
import { ACCOUNT_FLAG, readSaved, writeSaved } from "./saved";

type Order = { orderNumber: string; stage: string; paidAt: string | null; url: string | null };
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const status = $("[data-account-status]");
const say = (message: string) => { status.textContent = message; };

async function call<T>(path: string, method = "POST", body?: unknown): Promise<T> {
  const response = await fetch(`/api/account/${path}`, { method, headers: { "content-type": "application/json", "x-aha-account": "1" }, body: method === "GET" ? undefined : JSON.stringify(body ?? {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || "Accounts aren’t available right now. Try again in a minute.");
  return data as T;
}

const bytes = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), (char) => char.charCodeAt(0));
const b64 = (buffer: ArrayBuffer | null) => buffer ? btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : undefined;

async function credentialResponse(kind: "register" | "login", options: Record<string, any>) {
  const publicKey = { ...options, challenge: bytes(options.challenge) };
  // Accounts use discoverable passkeys, so the server never lists credential IDs.
  const credential = (kind === "register"
    ? await navigator.credentials.create({ publicKey: { ...publicKey, user: { ...options.user, id: bytes(options.user.id) }, excludeCredentials: (options.excludeCredentials ?? []).map((entry: any) => ({ ...entry, id: bytes(entry.id) })) } as unknown as PublicKeyCredentialCreationOptions })
    : await navigator.credentials.get({ publicKey: publicKey as unknown as PublicKeyCredentialRequestOptions })) as PublicKeyCredential;
  const result = credential.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse;
  const response = kind === "register"
    ? { clientDataJSON: b64(result.clientDataJSON), attestationObject: b64(result.attestationObject), transports: result.getTransports?.() ?? [] }
    : { clientDataJSON: b64(result.clientDataJSON), authenticatorData: b64(result.authenticatorData), signature: b64(result.signature), userHandle: b64(result.userHandle) };
  return { id: credential.id, rawId: b64(credential.rawId), type: credential.type, clientExtensionResults: credential.getClientExtensionResults(), authenticatorAttachment: credential.authenticatorAttachment ?? undefined, response };
}

async function passkey(kind: "register" | "login") {
  const { options, handle } = await call<{ options: Record<string, any>; handle: string }>(`auth/${kind}/options`);
  await call(`auth/${kind}/verify`, "POST", { handle, saved: readSaved(), response: await credentialResponse(kind, options) });
}

async function backup() {
  const proof = await call<{ options: Record<string, any>; handle: string }>("auth/login/options");
  const response = await credentialResponse("login", proof.options);
  const registration = await call<{ options: Record<string, any>; handle: string }>("auth/backup/options", "POST", { handle: proof.handle, response });
  say("Choose another device or password manager for your backup passkey…");
  await call("auth/backup/verify", "POST", { handle: registration.handle, response: await credentialResponse("register", registration.options) });
}

// Pieces published live since the last deploy, or removed from sale, come from the live catalog.
let live: Awaited<ReturnType<typeof catalogState>> | null = null;
async function showSaved(list: string[]) {
  const grid = $("[data-saved-grid]");
  const cards = () => new Map([...grid.querySelectorAll<HTMLElement>("[data-saved-card]")].map((card) => [card.dataset.savedCard!, card]));
  if (list.length && !live) {
    live = await catalogState();
    for (const product of live.products) {
      if (cards().has(product.slug)) continue;
      const holder = Object.assign(document.createElement("div"), { hidden: true, innerHTML: product.card });
      holder.dataset.savedCard = product.slug;
      grid.append(holder);
    }
  }
  const removed = new Set(live?.retired ?? []);
  const all = cards();
  all.forEach((card) => { card.hidden = true; });
  const shown = list.flatMap((slug) => (removed.has(slug) ? [] : all.get(slug) ?? []));
  shown.forEach((card) => { card.hidden = false; });
  grid.prepend(...shown);
  $("[data-saved-empty]").hidden = shown.length > 0;
}

const STAGES: Record<string, string> = { paid: "Paid", production: "In production", shipped: "Shipped", review: "Being checked" };
function showOrders(orders: Order[]) {
  $("[data-account-orders]").hidden = false;
  $("[data-orders-empty]").hidden = orders.length > 0;
  $("[data-orders-list]").replaceChildren(...orders.map((order) => {
    const item = document.createElement("li");
    item.append(Object.assign(document.createElement("strong"), { textContent: `Order ${order.orderNumber}` }), ` ${STAGES[order.stage] ?? "Paid"}${order.paidAt ? ` · placed ${new Date(order.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""} `);
    if (order.url) item.append(Object.assign(document.createElement("a"), { href: order.url, className: "text-link", textContent: "Open" }));
    return item;
  }));
}

async function load() {
  await showSaved(readSaved());
  let me: { signedIn: boolean; saved?: string[]; orders?: Order[] } = { signedIn: false };
  try { me = await call("me", "GET"); } catch { /* Signed out is the safe view. */ }
  $("[data-account-out]").hidden = me.signedIn;
  $("[data-account-in]").hidden = !me.signedIn;
  $("[data-account-orders]").hidden = !me.signedIn;
  if (!me.signedIn) { localStorage.removeItem(ACCOUNT_FLAG); return; }
  localStorage.setItem(ACCOUNT_FLAG, "1");
  writeSaved(me.saved ?? [], false);
  await showSaved(me.saved ?? []);
  showOrders(me.orders ?? []);
}

function act(selector: string, work: () => Promise<unknown>, busy: string) {
  $(selector).addEventListener("click", async () => {
    const button = $(selector) as HTMLButtonElement;
    if (button.disabled) return;
    button.disabled = true;
    say(busy);
    try { await work(); say(selector === "[data-account-backup]" ? "Backup passkey saved. You can use either passkey to sign in." : ""); await load(); }
    catch (error) { say(error instanceof DOMException && error.name === "NotAllowedError" ? "The passkey prompt closed. Try again when you’re ready." : (error as Error).message); }
    finally { button.disabled = false; }
  });
}

if (!window.PublicKeyCredential) {
  document.querySelectorAll<HTMLButtonElement>("[data-account-create], [data-account-signin]").forEach((button) => { button.disabled = true; });
  say("This browser can’t use passkeys. Try an up-to-date Safari, Chrome, Edge or Firefox.");
}
act("[data-account-create]", () => passkey("register").then(() => document.dispatchEvent(new CustomEvent("aha:account-created"))), "Follow the passkey prompt to create your account…");
act("[data-account-signin]", () => passkey("login"), "Follow the passkey prompt to sign in…");
act("[data-account-backup]", backup, "Confirm your existing passkey first…");
act("[data-account-signout]", () => call("auth/logout").then(() => localStorage.removeItem(ACCOUNT_FLAG)), "Signing out…");
act("[data-account-delete]", async () => {
  if (!confirm("Delete your account? Your passkey link, saved pieces in the account and order list are removed. Your orders themselves aren’t affected.")) throw new Error("");
  await call("me", "DELETE");
  localStorage.removeItem(ACCOUNT_FLAG);
}, "Deleting your account…");
void load();
