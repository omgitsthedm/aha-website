"use client";

import { openConsentSettings } from "@/lib/consent/consent";

/** Footer control to reopen the cookie banner — doubles as the CPRA
 *  "Do Not Sell or Share" opt-out (Reject in the banner turns tracking off). */
export function ConsentSettingsLink() {
  return (
    <button
      type="button"
      onClick={openConsentSettings}
      className="inline-flex min-h-11 items-center text-left text-sm text-muted underline decoration-border underline-offset-4 hover:text-cream"
    >
      Do Not Sell or Share My Info
    </button>
  );
}
