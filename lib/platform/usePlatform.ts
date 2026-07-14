"use client";

import { useEffect, useState } from "react";
import { getPlatform, type PlatformInfo } from "./detect";

/**
 * Hydration-safe platform read. Returns `null` during SSR and the very first
 * client render (so server and client markup match — no React #418 on Safari),
 * then the real PlatformInfo after mount. Consumers render nothing until it
 * resolves, which is exactly what we want for optional, enhancement-only UI.
 */
export function usePlatform(): PlatformInfo | null {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);

  useEffect(() => {
    setPlatform(getPlatform());

    // display-mode can flip (e.g. user installs mid-session); keep it honest.
    let mql: MediaQueryList | null = null;
    const onChange = () => setPlatform(getPlatform());
    try {
      mql = window.matchMedia("(display-mode: standalone)");
      mql.addEventListener?.("change", onChange);
    } catch {
      /* matchMedia unavailable */
    }
    return () => mql?.removeEventListener?.("change", onChange);
  }, []);

  return platform;
}
