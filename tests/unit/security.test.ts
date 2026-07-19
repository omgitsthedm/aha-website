import { describe, it, expect } from "vitest";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { isScheduledInvocation } from "@/lib/security/cron-guard";

describe("rateLimit", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys are independent", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the Netlify connection-ip header", () => {
    const req = new Request("https://x.test", { headers: { "x-nf-client-connection-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1" } });
    expect(clientIp(req)).toBe("203.0.113.7");
  });
  it("falls back to the first x-forwarded-for hop", () => {
    const req = new Request("https://x.test", { headers: { "x-forwarded-for": "198.51.100.9, 10.0.0.1" } });
    expect(clientIp(req)).toBe("198.51.100.9");
  });
});

describe("isScheduledInvocation", () => {
  it("admits the documented scheduler POST (next_run body)", async () => {
    const req = new Request("https://x.test/.netlify/functions/reconcile-orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ next_run: "2026-07-19T13:00:00.000Z" }),
    });
    expect(await isScheduledInvocation(req)).toBe(true);
  });

  it("admits an authorized CRON_SECRET header", async () => {
    process.env.CRON_SECRET = "s3cr3t";
    const req = new Request("https://x.test", { method: "POST", headers: { authorization: "Bearer s3cr3t" } });
    expect(await isScheduledInvocation(req)).toBe(true);
    delete process.env.CRON_SECRET;
  });

  it("denies an unauthenticated GET drive-by", async () => {
    const req = new Request("https://x.test", { method: "GET" });
    expect(await isScheduledInvocation(req)).toBe(false);
  });

  it("denies a POST without next_run or secret", async () => {
    const req = new Request("https://x.test", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(await isScheduledInvocation(req)).toBe(false);
  });
});
