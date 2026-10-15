const SQUARE_VERSION = "2026-09-16";
const BASE_URL = "https://connect.squareup.com";

export function createSquareCheckoutGateway({ accessToken, fetchImpl = fetch, timeoutMs = 8_000, apiBase = BASE_URL }) {
  async function request(path, init = {}) {
    const response = await fetchImpl(`${apiBase}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${accessToken}`, "square-version": SQUARE_VERSION, "content-type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error("square_request_failed"); error.status = response.status; error.details = json; throw error; }
    return json;
  }
  return {
    async calculateOrder(order) { return (await request("/v2/orders/calculate", { method: "POST", body: JSON.stringify({ order }) })).order; },
    async createOrder(order, idempotencyKey) { return (await request("/v2/orders", { method: "POST", body: JSON.stringify({ order, idempotency_key: idempotencyKey }) })).order; },
    async createPayment(payment) { return (await request("/v2/payments", { method: "POST", body: JSON.stringify(payment) })).payment; },
    async getPayment(id) { return (await request(`/v2/payments/${encodeURIComponent(id)}`)).payment; },
    async getOrder(id) { return (await request(`/v2/orders/${encodeURIComponent(id)}`)).order; },
  };
}
