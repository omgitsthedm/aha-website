const RESEND_API = "https://api.resend.com";

export function createResendGateway({ apiKey, from, replyTo, fetchImpl = fetch, timeoutMs = 8_000 }) {
  async function request(path, init = {}) {
    const response = await fetchImpl(`${RESEND_API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${apiKey}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error("resend_request_failed"); error.status = response.status; throw error; }
    return data;
  }
  return {
    async send({ idempotencyKey, recipient, subject, html, text }) {
      return request("/emails", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ from, to: [recipient], reply_to: replyTo, subject, html, text, tags: [{ name: "stream", value: "transactional" }] }),
      });
    },
    async listDomains() { return request("/domains"); },
  };
}
