"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { usePlatform } from "@/lib/platform/usePlatform";
import { canPromptInstall, subscribeInstall, promptInstall } from "@/lib/platform/pwaInstall";
import { useConsent } from "@/lib/consent/consent";

const SEEN_KEY = "aha:install-hint-seen";
// Never compete with a primary bottom CTA: product pages have a sticky mobile
// add-to-bag bar, and cart/checkout/track have their own actions.
const HIDDEN_ROUTES = ["/cart", "/checkout", "/ops", "/track-order", "/product"];

/**
 * Offers installation the right way per platform:
 *  • Android / desktop Chrome & Edge → a branded button that fires the native
 *    prompt we buffered from `beforeinstallprompt`.
 *  • iOS / iPadOS Safari → a short "Add to Home Screen" coach, since Apple has
 *    no install event (Safari 26 opens home-screen sites as real web apps).
 *
 * Shows once (localStorage), never on the cart/checkout path, never inside an
 * in-app browser, never when already installed. One calm hint — not a nag.
 */
export function InstallPrompt() {
  const platform = usePlatform();
  const pathname = usePathname();
  const { consent } = useConsent();
  const [ready, setReady] = useState(false); // native prompt buffered
  const [visible, setVisible] = useState(false);
  const [seen, setSeen] = useState(true);

  // Track native-prompt availability.
  useEffect(() => {
    setReady(canPromptInstall());
    return subscribeInstall(() => setReady(canPromptInstall()));
  }, []);

  // Read the one-time flag, then reveal after a short beat so it never slams
  // the first paint.
  useEffect(() => {
    let flag = false;
    try {
      flag = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage blocked */
    }
    setSeen(flag);
    if (flag) return;
    const t = setTimeout(() => setVisible(true), 1400);
    return () => clearTimeout(t);
  }, []);

  if (consent === null) return null; // let the cookie banner resolve first
  if (!platform || seen || !visible) return null;
  if (platform.isStandalone || platform.inApp !== null) return null;
  if (pathname && HIDDEN_ROUTES.some((r) => pathname.startsWith(r))) return null;

  const isIos = platform.isIosSafari;
  const showAndroidDesktop = ready && !isIos;
  if (!isIos && !showAndroidDesktop) return null;

  const dismiss = () => {
    setVisible(false);
    setSeen(true);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage blocked — hint simply reappears next visit */
    }
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome) dismiss();
  };

  return (
    <div
      role="region"
      aria-label="Add After Hours Agenda to your home screen"
      className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-[290] border-t border-border/60 bg-void/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
            Add the sheep to your Home Screen
          </p>
          {isIos ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm leading-snug text-cream">
              Tap
              <IosShareGlyph />
              then <span className="font-semibold">Add to Home Screen</span> for the full app.
            </p>
          ) : (
            <p className="mt-1 text-sm leading-snug text-cream">
              Install After Hours Agenda for a faster, full-screen shop — no app store.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showAndroidDesktop && (
            <button type="button" onClick={install} className="btn-primary whitespace-nowrap">
              Install
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install hint"
            className="min-h-11 whitespace-nowrap px-2 text-[11px] font-bold uppercase tracking-wide text-muted underline underline-offset-4 hover:text-cream"
          >
            {isIos ? "Got it" : "Not now"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The iOS Share glyph (square with an up arrow), so the coach is unmistakable. */
function IosShareGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      role="img"
      aria-label="the Share icon"
      className="inline-block shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v11" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 12H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}
