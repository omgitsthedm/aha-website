import { SQUARE_VERSION } from "../platform/client.mjs";

const SQUARE_API = "https://connect.squareup.com/v2";

export function createSquareGateway({ accessToken, fetchImpl = fetch }) {
  if (!accessToken) throw new Error("Square access token is not configured.");
  async function request(path, init = {}, timeoutMs = 8_000) {
    const response = await fetchImpl(`${SQUARE_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_VERSION,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Square returned invalid JSON (${response.status}).`); }
    if (!response.ok) {
      const error = new Error(`Square request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  }
  return {
    getPayment: async (id, options = {}) => (await request(`/payments/${encodeURIComponent(id)}`, {}, options.timeoutMs)).payment,
    getOrder: async (id, options = {}) => (await request(`/orders/${encodeURIComponent(id)}`, {}, options.timeoutMs)).order,
    // Read-only: the daily health check compares these with the allow list.
    batchRetrieve: async (ids, options = {}) => {
      const objects = [];
      for (let start = 0; start < ids.length; start += 1000) {
        objects.push(...((await request("/catalog/batch-retrieve", { method: "POST", body: JSON.stringify({ object_ids: ids.slice(start, start + 1000), include_related_objects: false }) }, options.timeoutMs)).objects ?? []));
      }
      return objects;
    },
    updateShipment: async ({ order, fulfillmentUid, tracking }) => request(`/orders/${encodeURIComponent(order.id)}`, {
      method: "PUT",
      body: JSON.stringify({
        idempotency_key: `aha-ship-${order.id}-${fulfillmentUid}-v${order.version}`,
        order: {
          location_id: order.location_id,
          version: order.version,
          fulfillments: [{
            uid: fulfillmentUid,
            type: "SHIPMENT",
            state: "COMPLETED",
            shipment_details: {
              ...(tracking.carrier ? { carrier: tracking.carrier } : {}),
              ...(tracking.trackingNumber ? { tracking_number: tracking.trackingNumber } : {}),
              ...(tracking.trackingUrl ? { tracking_url: tracking.trackingUrl } : {}),
              shipped_at: tracking.shippedAt,
            },
          }],
        },
      }),
    }, tracking.timeoutMs),
  };
}
