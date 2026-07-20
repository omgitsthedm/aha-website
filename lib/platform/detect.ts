/**
 * Platform detection — one honest source of truth for "where is this page
 * actually running". Pure and SSR-safe: pass a user-agent string, or call the
 * argless helpers which read `navigator` only in the browser. Never throws;
 * an unknown environment resolves to safe, feature-neutral defaults so nothing
 * here can ever break the purchase flow.
 *
 * Nothing in this module changes prices, caches commerce data, or gates the
 * cart. It only tells the UI which *optional* affordance (install hint, "open
 * in your browser" nudge) is worth offering — always as enhancement.
 */

type OS = "ios" | "ipados" | "android" | "macos" | "windows" | "other";
type Engine = "webkit" | "blink" | "gecko" | "other";

/** In-app webviews that ship inside social apps. `null` = a real browser. */
export type InAppBrowser =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "messenger"
  | "snapchat"
  | "twitter"
  | "linkedin"
  | "pinterest"
  | "line"
  | "wechat"
  | "webview" // generic Android/other embedded webview
  | null;

export interface PlatformInfo {
  os: OS;
  engine: Engine;
  /** Coarse device class for layout/interaction decisions. */
  device: "phone" | "tablet" | "desktop";
  /** The social app whose embedded browser we're inside, if any. */
  inApp: InAppBrowser;
  /** Running as an installed PWA (standalone display / iOS home-screen app). */
  isStandalone: boolean;
  /** True iOS/iPadOS Safari, not a webview — the only place A2HS can work. */
  isIosSafari: boolean;
  /** Touch is the primary pointer (coarse). */
  isTouch: boolean;
}

const has = (ua: string, ...tokens: string[]) =>
  tokens.some((t) => ua.toLowerCase().includes(t.toLowerCase()));

/** Which social in-app browser, from a UA string. Order matters: FB/Messenger
 *  share FBAN, so test the more specific token first. */
function detectInApp(ua: string): InAppBrowser {
  if (!ua) return null;
  if (has(ua, "Instagram")) return "instagram";
  if (has(ua, "BytedanceWebview", "musical_ly", "TikTok", "trill", "Bytedance")) return "tiktok";
  if (has(ua, "FBAN/Messenger", "Messenger")) return "messenger";
  if (has(ua, "FBAN", "FBAV", "FB_IAB", "FB4A")) return "facebook";
  if (has(ua, "Snapchat")) return "snapchat";
  if (has(ua, "TwitterAndroid") || / Twitter/i.test(ua)) return "twitter";
  if (has(ua, "LinkedInApp")) return "linkedin";
  if (has(ua, "Pinterest")) return "pinterest";
  if (has(ua, "Line/")) return "line";
  if (has(ua, "MicroMessenger")) return "wechat";
  // Generic Android system webview (Chrome Custom Tab reports normally, wv doesn't).
  if (/; wv\)/.test(ua)) return "webview";
  return null;
}

function detectOS(ua: string, maxTouchPoints = 0): OS {
  if (!ua) return "other";
  if (/iPhone|iPod/.test(ua)) return "ios";
  if (/iPad/.test(ua)) return "ipados";
  // iPadOS 13+ masquerades as macOS Safari; touch points give it away.
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return "ipados";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh|Mac OS X/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  return "other";
}

function detectEngine(ua: string): Engine {
  if (!ua) return "other";
  // On iOS every engine is WebKit regardless of the browser badge.
  if (/iPhone|iPad|iPod/.test(ua)) return "webkit";
  if (/Edg\/|Chrome\/|CriOS|Chromium/.test(ua)) return "blink";
  if (/Firefox\/|FxiOS/.test(ua)) return "gecko";
  if (/AppleWebKit/.test(ua) && /Safari/.test(ua)) return "webkit";
  return "other";
}

/**
 * Build a full PlatformInfo from raw inputs. Kept pure so it can be unit-tested
 * and, if ever needed, run against a server-provided UA header.
 */
function detectPlatform(
  ua: string,
  opts: { maxTouchPoints?: number; standalone?: boolean; iosStandalone?: boolean } = {}
): PlatformInfo {
  const os = detectOS(ua, opts.maxTouchPoints ?? 0);
  const engine = detectEngine(ua);
  const inApp = detectInApp(ua);
  const isTouch = os === "ios" || os === "ipados" || os === "android" || (opts.maxTouchPoints ?? 0) > 0;

  const device: PlatformInfo["device"] =
    os === "ipados"
      ? "tablet"
      : os === "ios" || (os === "android" && !/Tablet|SM-T|Nexus (7|9|10)/.test(ua))
      ? "phone"
      : os === "android"
      ? "tablet"
      : "desktop";

  const isStandalone = Boolean(opts.standalone || opts.iosStandalone);

  // iOS/iPadOS Safari specifically (a webview would have matched inApp above,
  // and Chrome/Firefox on iOS carry CriOS/FxiOS badges).
  const isIosSafari =
    (os === "ios" || os === "ipados") &&
    inApp === null &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  return { os, engine, device, inApp, isStandalone, isIosSafari, isTouch };
}

/** Read the live platform from `navigator`/`window`. Safe on the server: returns
 *  neutral defaults (desktop, no in-app, not standalone) so the first client
 *  render matches SSR. Call from an effect once mounted to get real values. */
export function getPlatform(): PlatformInfo {
  if (typeof navigator === "undefined") {
    return {
      os: "other",
      engine: "other",
      device: "desktop",
      inApp: null,
      isStandalone: false,
      isIosSafari: false,
      isTouch: false,
    };
  }
  const ua = navigator.userAgent || "";
  let standalone = false;
  try {
    standalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    /* matchMedia unavailable — treat as browser tab */
  }
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectPlatform(ua, {
    maxTouchPoints: navigator.maxTouchPoints || 0,
    standalone,
    iosStandalone,
  });
}

/** Human label + escape instruction for an in-app browser nudge. */
export function inAppLabel(inApp: InAppBrowser): { name: string; how: string } | null {
  if (!inApp) return null;
  const menu = "Tap the ••• menu, then “Open in browser”";
  const map: Record<Exclude<InAppBrowser, null>, { name: string; how: string }> = {
    instagram: { name: "Instagram", how: menu },
    tiktok: { name: "TikTok", how: menu },
    facebook: { name: "Facebook", how: menu },
    messenger: { name: "Messenger", how: menu },
    snapchat: { name: "Snapchat", how: "Tap the ••• menu, then “Open in Safari / Chrome”" },
    twitter: { name: "X", how: menu },
    linkedin: { name: "LinkedIn", how: menu },
    pinterest: { name: "Pinterest", how: menu },
    line: { name: "LINE", how: "Tap the menu, then “Open in other browser”" },
    wechat: { name: "WeChat", how: "Tap the ••• menu, then “Open in browser”" },
    webview: { name: "this app’s browser", how: "Open this page in Safari or Chrome" },
  };
  return map[inApp];
}
