"use client";

import { useEffect, useState } from "react";
import { usePlatform } from "@/lib/platform/usePlatform";
import { inAppLabel } from "@/lib/platform/detect";

const DISMISS_KEY = "aha:inapp-nudge-dismissed";

/**
 * Escape hatch for shoppers who tapped a link from Instagram, TikTok, Facebook,
 * etc. Those apps render pages inside a stripped-down webview where Apple Pay /
 * Google Pay can misfire, "Add to Home Screen" is impossible, and the share
 * sheet is unreliable — so we offer one calm, dismissible way out to the real
 * browser. Renders nothing in a normal browser or an installed app.
 *
 * Doctrine: one contextual hint, never a modal ambush. No fake urgency. It
 * simply names the situation and how to fix it, then gets out of the way.
 */
export function InAppBrowserNudge() {
  const platform = usePlatform();
  const [dismissed, setDismissed] = useState(true); // assume dismissed until we can read storage

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!platform || platform.inApp === null || dismissed) return null;

  const label = inAppLabel(platform.inApp);
  if (!label) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — dismiss holds for this render only */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* clipboard blocked in some webviews — the instruction still stands */
    }
  };

  return (
    <div
      role="region"
      aria-label={`You're browsing inside ${label.name}`}
      className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-[300] border-t border-border/60 bg-void/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-3xl items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
            You&rsquo;re in {label.name}&rsquo;s browser
          </p>
          <p className="mt-1 text-sm leading-snug text-cream">
            Open in Safari or Chrome for Apple&nbsp;Pay and faster checkout.
            <span className="mt-1 block text-muted">{label.how}.</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="min-h-11 whitespace-nowrap border border-border/60 px-3 text-[11px] font-bold uppercase tracking-wide text-cream transition-colors hover:border-accent hover:text-accent"
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss browser notice"
            className="min-h-11 whitespace-nowrap px-3 text-[11px] font-bold uppercase tracking-wide text-muted underline underline-offset-4 hover:text-cream"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
