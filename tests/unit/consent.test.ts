import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getConsent,
  isGlobalPrivacyControlEnabled,
  setConsent,
} from "@/lib/consent/consent";

const stored = new Map<string, string>();

function installBrowserGlobals(globalPrivacyControl: boolean) {
  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", { globalPrivacyControl });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
}

afterEach(() => {
  stored.clear();
  vi.unstubAllGlobals();
});

describe("Global Privacy Control", () => {
  it("leaves an explicit granted choice intact when GPC is off", () => {
    installBrowserGlobals(false);
    stored.set("aha-cookie-consent", "granted");

    expect(isGlobalPrivacyControlEnabled()).toBe(false);
    expect(getConsent()).toBe("granted");
  });

  it("overrides a stored grant while GPC is active", () => {
    installBrowserGlobals(true);
    stored.set("aha-cookie-consent", "granted");

    expect(isGlobalPrivacyControlEnabled()).toBe(true);
    expect(getConsent()).toBe("denied");
  });

  it("cannot persist an analytics grant while GPC is active", () => {
    installBrowserGlobals(true);

    setConsent("granted");

    expect(stored.get("aha-cookie-consent")).toBe("denied");
    expect(getConsent()).toBe("denied");
  });

  it("keeps the choice for the session when browser storage is unavailable", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { globalPrivacyControl: false });
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new DOMException("Storage unavailable", "SecurityError"); },
      setItem: () => { throw new DOMException("Storage unavailable", "SecurityError"); },
    });

    setConsent("granted");

    expect(getConsent()).toBe("granted");
  });
});
