"use client";

/**
 * Captures Chrome/Edge/Android's `beforeinstallprompt` the moment it fires —
 * which can be before any React component mounts — and buffers it so a UI can
 * offer a branded "Install" button whenever it's ready. iOS has no such event
 * (handled separately with an Add-to-Home-Screen coach).
 *
 * Enhancement only: if the event never fires, everything here stays silent.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((cb) => cb());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // suppress Chrome's default mini-infobar; we prompt on our terms
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

/** True when a native install prompt is available to fire. */
export const canPromptInstall = () => deferred !== null && !installed;

/** Subscribe to availability changes; returns an unsubscribe fn. */
export function subscribeInstall(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Fire the buffered native prompt. Returns the user's choice, or null if none
 *  was available. The event is single-use, so we clear it after. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  if (!deferred) return null;
  const event = deferred;
  deferred = null;
  notify();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return null;
  }
}
