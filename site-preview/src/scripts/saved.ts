// Saved pieces live in this browser, and in the account when signed in.
// aha-account-v1 only notes that this browser has signed in; the session itself
// is an HttpOnly cookie.
const KEY = "aha-saved-v1";
export const ACCOUNT_FLAG = "aha-account-v1";
export function readSaved(): string[] {
  try { const list = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(list) ? list.filter((slug) => typeof slug === "string").slice(0, 60) : []; } catch { return []; }
}
export function writeSaved(list: string[], sync = true) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60))); } catch { /* Storage is optional. */ }
  if (sync && localStorage.getItem(ACCOUNT_FLAG)) void fetch("/api/account/saved", { method: "PUT", headers: { "content-type": "application/json", "x-aha-account": "1" }, body: JSON.stringify({ saved: list }) }).then((response) => { if (response.status === 401) localStorage.removeItem(ACCOUNT_FLAG); }).catch(() => {});
}
