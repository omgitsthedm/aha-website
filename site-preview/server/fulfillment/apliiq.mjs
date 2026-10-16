import { createHmac } from "node:crypto";

export const APLIIQ_API_BASE = "https://api.apliiq.com/v1";

function authHeader({ apiKey, sharedSecret, rawBody, now = new Date(), nonce = crypto.randomUUID() }) {
  const timestamp = Math.floor(now.getTime() / 1000);
  const encoded = Buffer.from(rawBody, "utf8").toString("base64");
  const signature = createHmac("sha256", sharedSecret)
    .update(`${apiKey}${timestamp}${nonce}${encoded}`, "utf8")
    .digest("base64");
  return `x-apliiq-auth ${timestamp}:${signature}:${apiKey}:${nonce}`;
}

export function createApliiqGateway({ apiKey, sharedSecret, fetchImpl = fetch, now, nonce }) {
  if (!apiKey || !sharedSecret) throw new Error("Apliiq credentials are not configured.");
  async function request(path, { method = "GET", body, timeoutMs = 8_000 } = {}) {
    const rawBody = body === undefined ? "" : JSON.stringify(body);
    const response = await fetchImpl(`${APLIIQ_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: authHeader({ apiKey, sharedSecret, rawBody, now: now?.(), nonce: nonce?.() }),
        Accept: "application/json",
        ...(rawBody ? { "Content-Type": "application/json" } : {}),
      },
      ...(rawBody ? { body: rawBody } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Apliiq returned invalid JSON (${response.status}).`); }
    if (!response.ok) {
      const error = new Error(`Apliiq request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return { status: response.status, data };
  }
  return {
    createOrder: (payload, options = {}) => request("/Order", { method: "POST", body: payload, ...options }),
    getOrder: async (orderId, options = {}) => (await request(`/Order/${encodeURIComponent(String(orderId))}`, options)).data,
    listOrders: async (options = {}) => (await request("/Order", options)).data,
    // Permanent. Only the admin's guarded "Delete Apliiq design" calls this.
    deleteDesign: async (designId, options = {}) => request(`/Design/${encodeURIComponent(String(designId))}`, { method: "DELETE", ...options }),
  };
}
