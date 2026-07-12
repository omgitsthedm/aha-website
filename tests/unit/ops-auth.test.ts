import { afterEach, describe, expect, it } from "vitest";
import { createOpsSessionToken, verifyOpsPassword, verifyOpsSessionToken } from "@/lib/ops/auth";

const originalPassword = process.env.AHA_OPS_PASSWORD;
const originalSecret = process.env.AHA_OPS_SESSION_SECRET;

afterEach(() => {
  process.env.AHA_OPS_PASSWORD = originalPassword;
  process.env.AHA_OPS_SESSION_SECRET = originalSecret;
});

describe("operations authentication", () => {
  it("accepts only the configured password", () => {
    process.env.AHA_OPS_PASSWORD = "test-password";
    expect(verifyOpsPassword("test-password")).toBe(true);
    expect(verifyOpsPassword("wrong-password")).toBe(false);
  });

  it("signs and verifies the private operations session", () => {
    process.env.AHA_OPS_SESSION_SECRET = "test-session-secret";
    const token = createOpsSessionToken();
    expect(verifyOpsSessionToken(token)).toBe(true);
    expect(verifyOpsSessionToken(`${token}x`)).toBe(false);
  });
});
