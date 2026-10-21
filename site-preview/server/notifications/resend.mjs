const RESEND_API = "https://api.resend.com";

export function createResendGateway({ apiKey, from, replyTo: defaultReplyTo, fetchImpl = fetch, timeoutMs = 8_000 }) {
  async function request(path, init = {}) {
    const response = await fetchImpl(`${RESEND_API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${apiKey}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error("resend_request_failed");
      error.status = response.status;
      // Sending-only keys are intentionally forbidden from account/domain reads.
      // Preserve only this safe, known classification; never expose provider detail.
      if (data?.name === "restricted_api_key") error.resendReason = "restricted_api_key";
      throw error;
    }
    return data;
  }
  return {
    async send({ idempotencyKey, recipient, subject, html, text, headers, replyTo = defaultReplyTo, stream = "transactional" }) {
      return request("/emails", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ from, to: [recipient], reply_to: replyTo, subject, html, text, ...(headers ? { headers } : {}), tags: [{ name: "stream", value: stream }] }),
      });
    },
    async listDomains() { return request("/domains"); },
  };
}
