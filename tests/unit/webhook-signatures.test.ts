import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySquareWebhookSignature } from "@/lib/square/webhooks";
import { verifyPrintfulWebhookSignature } from "@/lib/printful/webhooks";

describe("webhook signatures", () => {
  it("binds a Square signature to the exact notification URL", () => {
    const rawBody = '{"event_id":"evt-1"}';
    const key = "square-signature-key";
    const url = "https://afterhoursagenda.com/api/webhooks/square";
    const signature = createHmac("sha256", key).update(`${url}${rawBody}`).digest("base64");

    expect(verifySquareWebhookSignature({ rawBody, signature, signatureKey: key, notificationUrl: url })).toBe(true);
    expect(verifySquareWebhookSignature({ rawBody, signature, signatureKey: key, notificationUrl: "https://www.afterhoursagenda.com/api/webhooks/square" })).toBe(false);
  });

  it("validates Printful's raw-body HMAC", () => {
    const rawBody = '{"type":"shipment_sent"}';
    const secretHex = Buffer.from("printful-secret").toString("hex");
    const signature = createHmac("sha256", Buffer.from(secretHex, "hex")).update(rawBody).digest("hex");
    expect(verifyPrintfulWebhookSignature({ rawBody, signature, secretKeyHex: secretHex })).toBe(true);
  });
});
