import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Resend outbox so no real email is ever sent from the test.
const { sendMock, configuredMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  configuredMock: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({
  sendTransactionalEmail: sendMock,
  isTransactionalEmailConfigured: configuredMock,
}));

import { reportCheckoutError } from "@/lib/commerce/checkout-alert";

describe("reportCheckoutError", () => {
  beforeEach(() => {
    sendMock.mockReset().mockResolvedValue("msg_test");
    configuredMock.mockReset().mockReturnValue(true);
    process.env.ORDER_SUPPORT_EMAIL = "info@afterhoursagenda.com";
    delete process.env.CONTEXT;
  });

  it("sends one alert email on a fresh error", async () => {
    await reportCheckoutError({ route: "test-a", stage: "s", err: new Error("boom") });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0] as { subject: string; to: string };
    expect(arg.to).toBe("info@afterhoursagenda.com");
    expect(arg.subject).toContain("test-a/s");
  });

  it("throttles a second identical alert within the window", async () => {
    await reportCheckoutError({ route: "test-b", stage: "s", err: new Error("x") });
    await reportCheckoutError({ route: "test-b", stage: "s", err: new Error("x") });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("never throws when the email send rejects", async () => {
    sendMock.mockRejectedValue(new Error("resend down"));
    await expect(
      reportCheckoutError({ route: "test-c", stage: "s", err: new Error("y") })
    ).resolves.toBeUndefined();
  });

  it("stays silent outside production", async () => {
    process.env.CONTEXT = "deploy-preview";
    await reportCheckoutError({ route: "test-d", stage: "s", err: new Error("z") });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("stays silent when transactional email is unconfigured", async () => {
    configuredMock.mockReturnValue(false);
    await reportCheckoutError({ route: "test-e", stage: "s", err: new Error("q") });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
