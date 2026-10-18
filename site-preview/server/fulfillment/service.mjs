import { AHA_FULFILLMENT_CATALOG } from "./catalog.mjs";
import { sha256 } from "./crypto.mjs";

const TERMINAL_PROVIDER_STATES = new Set(["cancelled", "canceled", "attention"]);

export class FulfillmentHold extends Error {
  constructor(code) { super(code); this.code = code; }
}

function requiredString(value, code) {
  if (typeof value !== "string" || !value.trim()) throw new FulfillmentHold(code);
  return value.trim();
}

function money(value, code) {
  if (!value || value.currency !== "USD" || !Number.isSafeInteger(value.amount)) throw new FulfillmentHold(code);
  return value.amount;
}

function positiveQuantity(value, code) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1) throw new FulfillmentHold(code);
  return quantity;
}

function parseActivation(value) {
  const date = new Date(value ?? "");
  if (!value || Number.isNaN(date.getTime())) throw new FulfillmentHold("activation_not_configured");
  return date;
}

function shippingAddress(details) {
  const address = details?.recipient?.address;
  if (!address) throw new FulfillmentHold("shipping_address_missing");
  const displayName = requiredString(details.recipient?.display_name, "shipping_name_missing").split(/\s+/);
  if (displayName.length < 2) throw new FulfillmentHold("shipping_name_missing");
  const firstName = displayName[0];
  const lastName = displayName.slice(1).join(" ");
  const countryCode = requiredString(address.country, "shipping_country_missing").toUpperCase();
  const province = requiredString(address.administrative_district_level_1, "shipping_state_missing");
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new FulfillmentHold("shipping_country_invalid");
  let country;
  try { country = new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode); } catch { country = undefined; }
  if (!country || country === countryCode) throw new FulfillmentHold("shipping_country_invalid");
  const provinceCode = province.toUpperCase();
  if (countryCode === "US" && !/^[A-Z]{2}$/.test(provinceCode)) throw new FulfillmentHold("shipping_region_invalid");
  return {
    firstName, lastName,
    address1: requiredString(address.address_line_1, "shipping_address_missing"),
    ...(address.address_line_2 ? { address2: address.address_line_2 } : {}),
    city: requiredString(address.locality, "shipping_city_missing"),
    zip: requiredString(address.postal_code, "shipping_postal_missing"),
    province,
    ...(countryCode === "US" ? { provinceCode } : {}),
    country,
    countryCode,
    ...(details.recipient?.phone_number ? { phone: details.recipient.phone_number } : {}),
  };
}

function fulfillmentTitle(item) {
  const legacy = { crewneck: "Yikes Crewneck", cropped_hoodie: "Yikes Cropped Hoodie" };
  return requiredString(item.title || legacy[item.product], "catalog_title_missing");
}

function validateKnownLines(order, catalog) {
  if (!Array.isArray(order.line_items) || order.line_items.length === 0) throw new FulfillmentHold("order_lines_missing");
  return order.line_items.map((line, index) => {
    const variationId = requiredString(line.catalog_object_id, "unknown_variation");
    const mapped = catalog[variationId];
    if (!mapped) throw new FulfillmentHold("unknown_variation");
    const quantity = positiveQuantity(line.quantity, "line_quantity_invalid");
    if (money(line.base_price_money, "line_price_invalid") !== mapped.priceCents) throw new FulfillmentHold("line_price_mismatch");
    return {
      squareLineUid: requiredString(line.uid, "line_uid_missing"),
      variationId,
      sku: mapped.sku,
      size: mapped.size,
      product: mapped.product,
      title: fulfillmentTitle(mapped),
      quantity,
      priceCents: mapped.priceCents,
      position: index,
    };
  });
}

/**
 * Turn fresh Square API objects into an immutable, allow-listed submission.
 * This rejects every order shape we do not explicitly support.
 */
export function validatePaidSquareOrder({ payment, order, locationId, startAt, catalog = AHA_FULFILLMENT_CATALOG }) {
  const activation = parseActivation(startAt);
  if (payment.status !== "COMPLETED") throw new FulfillmentHold("payment_not_completed");
  if (payment.location_id !== locationId || order.location_id !== locationId) throw new FulfillmentHold("location_mismatch");
  if (requiredString(payment.order_id, "payment_order_missing") !== requiredString(order.id, "order_id_missing")) throw new FulfillmentHold("payment_order_mismatch");
  const paymentCreatedAt = new Date(requiredString(payment.created_at, "payment_created_at_missing"));
  if (Number.isNaN(paymentCreatedAt.getTime())) throw new FulfillmentHold("payment_created_at_invalid");
  if (paymentCreatedAt < activation) throw new FulfillmentHold("before_activation");
  if (payment.refunded_money?.amount > 0 || (Array.isArray(payment.refund_ids) && payment.refund_ids.length > 0)) throw new FulfillmentHold("payment_refunded");
  if (["CANCELED", "CANCELLED"].includes(order.state)) throw new FulfillmentHold("order_cancelled");
  if (money(payment.amount_money, "payment_currency_invalid") !== money(order.total_money, "order_currency_invalid")) throw new FulfillmentHold("payment_not_full");
  const fulfillments = order.fulfillments;
  if (!Array.isArray(fulfillments) || fulfillments.length !== 1 || fulfillments[0]?.type !== "SHIPMENT") {
    throw new FulfillmentHold("unsupported_fulfillment_shape");
  }
  const fulfillment = fulfillments[0];
  if (!["PROPOSED", "RESERVED"].includes(fulfillment.state)) throw new FulfillmentHold("fulfillment_not_open");
  const items = validateKnownLines(order, catalog);
  const address = shippingAddress(fulfillment.shipment_details);
  const paymentEmail = typeof payment.buyer_email_address === "string" ? payment.buyer_email_address.trim() : "";
  const recipientEmail = typeof fulfillment.shipment_details?.recipient?.email_address === "string" ? fulfillment.shipment_details.recipient.email_address.trim() : "";
  const customerEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentEmail) ? paymentEmail : (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) ? recipientEmail : null);
  return {
    squareOrderId: order.id,
    squarePaymentId: payment.id,
    squareFulfillmentUid: requiredString(fulfillment.uid, "fulfillment_uid_missing"),
    paymentCreatedAt: payment.created_at ?? null,
    customerEmail,
    orderNumber: order.reference_id || order.id,
    totalAmount: money(order.total_money, "order_currency_invalid"),
    currency: order.total_money.currency,
    items,
    shippingAddress: address,
    apliiqPayload: {
      id: order.id,
      number: order.reference_id || order.id,
      name: `After Hours Agenda ${order.reference_id || order.id}`,
      order_number: order.reference_id || order.id,
      line_items: items.map((item) => ({
        id: `${order.id}:${item.squareLineUid}`,
        title: `${fulfillmentTitle(item)} — ${item.size}`,
        quantity: item.quantity,
        price: (item.priceCents / 100).toFixed(2),
        sku: item.sku,
      })),
      shipping_address: {
        first_name: address.firstName, last_name: address.lastName,
        address1: address.address1, ...(address.address2 ? { address2: address.address2 } : {}),
        ...(address.phone ? { phone: address.phone } : {}), city: address.city, zip: address.zip,
        province: address.province, ...(address.provinceCode ? { province_code: address.provinceCode } : {}),
        country: address.country, country_code: address.countryCode,
      },
      shipping_lines: [{ code: "standard" }],
    },
  };
}

function providerOrderId(response) {
  const value = response?.id ?? response?.OrderId ?? response?.order_id;
  return value === undefined || value === null ? null : String(value);
}

// Square also sends completed, custom-amount POS receipts to this webhook.
// Only that narrow non-shipping shape is irrelevant to fulfillment. A known
// catalog line, storefront reference, existing fulfillment or malformed order
// must still go through the normal fail-closed validation below.
function isCompletedCustomReceipt(payment, order, locationId) {
  return payment?.status === "COMPLETED" && order?.state === "COMPLETED"
    && payment.order_id === order.id && payment.location_id === locationId && order.location_id === locationId
    && payment.amount_money?.currency === "USD" && order.total_money?.currency === "USD"
    && Number.isSafeInteger(payment.amount_money?.amount) && payment.amount_money.amount === order.total_money.amount
    && !order.reference_id
    && (order.fulfillments === undefined || (Array.isArray(order.fulfillments) && order.fulfillments.length === 0))
    && Array.isArray(order.line_items) && order.line_items.length > 0
    && order.line_items.every((line) => !line.catalog_object_id);
}

// GET /Order is the documented source for the store-system ID, Apliiq ID,
// status and shipment notices. Use one uniquely matched record for all four;
// never join it to an unverified first row from a second response.
function matchingProviderOrders(record, providerOrders) {
  return Array.isArray(providerOrders)
    ? providerOrders.filter((item) => String(item.StoreSystemOrderId ?? "") === String(record.square_order_id))
    : [];
}

function safeProviderError(error) {
  if (Number.isInteger(error?.status)) return `apliiq_http_${error.status}`;
  return "apliiq_ambiguous";
}

function acceptedReason(response) {
  const message = String(response?.message ?? response?.Message ?? "").toLowerCase();
  if (message.includes("payment") || message.includes("billing")) return "apliiq_accepted_billing";
  if (message.includes("artwork")) return "apliiq_accepted_artwork";
  if (message.includes("garment") || message.includes("stock")) return "apliiq_accepted_garment";
  if (message.includes("address")) return "apliiq_accepted_address";
  return "apliiq_accepted";
}

export function createFulfillmentService({ repository, square, apliiq, notifications = { enqueueConfirmation: async () => null, enqueueShipment: async () => null }, config, catalog = AHA_FULFILLMENT_CATALOG, now = () => new Date() }) {
  const deadlineRemaining = (deadline) => Math.max(0, Math.min(8_000, deadline - Date.now()));
  // Cancellation window: a paid order is recorded and confirmed at once, but it
  // reaches Apliiq only after this many minutes, when the scheduled run re-reads
  // Square. A refund or cancellation inside the window is held, never produced.
  const holdMs = () => Math.max(0, Number(config.holdMinutes ?? 0) || 0) * 60_000;
  function withinHold(paymentCreatedAt) {
    const ms = holdMs();
    if (!ms || !paymentCreatedAt) return false;
    const paidAt = new Date(paymentCreatedAt).getTime();
    return Number.isFinite(paidAt) && now().getTime() - paidAt < ms;
  }
  async function hold(squareOrderId, code, detail = {}) {
    const existing = await repository.getOrder(squareOrderId);
    if (existing && existing.state !== "held") {
      await repository.setProviderState({ squareOrderId, providerStatus: "attention", state: "attention", lastErrorCode: code });
      return { outcome: "attention", code };
    }
    await repository.upsertHold({ squareOrderId, state: "held", lastErrorCode: code, ...detail });
    return { outcome: "held", code };
  }

  async function submitClaimed({ record, payload, deadline }) {
    try {
      const timeoutMs = deadline ? deadlineRemaining(deadline) : 8_000;
      // The durable claim exists before a provider POST. If this invocation
      // already lacks time to start that POST, release only this untouched
      // claim; once fetch is called, ambiguity is always preserved as uncertain.
      if (timeoutMs < 1_000) {
        await repository.releaseSubmissionClaim(record.square_order_id);
        return { outcome: "deferred", retryable: true };
      }
      const response = await apliiq.createOrder(payload, { timeoutMs });
      const id = providerOrderId(response.data);
      if (response.status === 200) {
        await repository.markSubmission({ squareOrderId: record.square_order_id, state: "submitted_processed", apliiqOrderId: id, providerStatus: "processed" });
        return { outcome: "submitted_processed" };
      }
      if (response.status === 202) {
        await repository.markSubmission({ squareOrderId: record.square_order_id, state: "submitted_accepted", apliiqOrderId: id, providerStatus: "accepted", lastErrorCode: acceptedReason(response.data) });
        return { outcome: "submitted_accepted" };
      }
      throw new Error("unexpected_apliiq_status");
    } catch (error) {
      // A timeout or 5xx may have accepted the order. This claim is terminal
      // for POST purposes; reconciliation is the only subsequent operation.
      await repository.markUncertain({ squareOrderId: record.square_order_id, code: safeProviderError(error) });
      return { outcome: "uncertain" };
    }
  }

  async function submitValidated(validated, deadline) {
    if (deadline && deadlineRemaining(deadline) < 2_000) return { outcome: "deferred", retryable: true };
    const record = await repository.insertValidated({
      ...validated,
      state: "queued",
      submittedItems: validated.items,
      payloadSha256: sha256(JSON.stringify(validated.apliiqPayload)),
    });
    if (record.state !== "queued") return { outcome: "already_known", state: record.state };
    if (record.payload_sha256 !== sha256(JSON.stringify(validated.apliiqPayload))) return hold(validated.squareOrderId, "payload_changed");
    // Queue the confirmation before a provider submission. If the durable
    // enqueue fails, the signed Square event remains retryable and no customer
    // email is lost or sent twice.
    await notifications.enqueueConfirmation({ recipient: validated.customerEmail, orderId: validated.squareOrderId, orderNumber: validated.orderNumber, totalAmount: validated.totalAmount, currency: validated.currency, items: validated.items.map((item) => ({ title: fulfillmentTitle(item), size: item.size, quantity: item.quantity })) });
    if (withinHold(validated.paymentCreatedAt)) return { outcome: "queued_hold" };
    if (deadline && deadlineRemaining(deadline) < 2_000) return { outcome: "deferred", retryable: true };
    const claimed = await repository.claimForSubmission(validated.squareOrderId);
    if (!claimed) return { outcome: "already_claimed" };
    return submitClaimed({ record: claimed, payload: validated.apliiqPayload, deadline });
  }

  async function processSquarePayment(paymentId, deadline) {
    if (config.enabled !== "true") return { outcome: "disabled", retryable: true };
    if (deadline && deadlineRemaining(deadline) < 2_000) return { outcome: "deferred", retryable: true };
    const payment = await square.getPayment(paymentId, { timeoutMs: deadline ? deadlineRemaining(deadline) : 8_000 });
    if (!payment?.order_id) return { outcome: "ignored", code: "payment_order_missing" };
    if (deadline && deadlineRemaining(deadline) < 1_000) return { outcome: "deferred", retryable: true };
    const order = await square.getOrder(payment.order_id, { timeoutMs: deadline ? deadlineRemaining(deadline) : 8_000 });
    if (isCompletedCustomReceipt(payment, order, config.locationId)) {
      const existing = await repository.getOrder(order.id);
      if (!existing || existing.state === "ignored") return { outcome: "ignored", code: "non_shipping_receipt" };
    }
    let validated;
    try {
      validated = validatePaidSquareOrder({ payment, order, locationId: config.locationId, startAt: config.startAt, catalog });
    } catch (error) {
      // A created/authorized payment is expected to arrive before its
      // completed update. It is neither an error nor a durable hold.
      if (error instanceof FulfillmentHold && error.code === "payment_not_completed") {
        if (["CANCELED", "FAILED", "VOIDED"].includes(payment.status)) return hold(order?.id ?? payment.order_id, "payment_terminal", { squarePaymentId: payment.id });
        return { outcome: "pending", code: error.code, retryable: true };
      }
      if (error instanceof FulfillmentHold) return hold(order?.id ?? payment.order_id, error.code, { squarePaymentId: payment.id });
      throw error;
    }
    return submitValidated(validated, deadline);
  }

  async function processSquareEvent(eventId, deadline) {
    if (config.enabled !== "true") return { outcome: "disabled", retryable: true };
    const event = await repository.claimSquareEvent(eventId);
    if (!event) return { outcome: "duplicate" };
    try {
      const result = await processSquarePayment(event.square_payment_id, deadline);
      if (result.retryable) {
        await repository.noteSquareEventError(eventId, result.code ?? result.outcome);
        return result;
      }
      await repository.markSquareEventProcessed(eventId);
      return result;
    } catch (error) {
      await repository.noteSquareEventError(eventId, "square_event_processing_failed");
      throw error;
    }
  }

  async function reconcileProvider(record, providerOrders, deadline) {
    const matches = matchingProviderOrders(record, providerOrders);
    if (matches.length > 1) {
      await repository.setProviderState({ squareOrderId: record.square_order_id, providerStatus: "id_mismatch", state: "attention", lastErrorCode: "provider_join_ambiguous" });
      return { outcome: "attention" };
    }
    const matching = matches[0];
    if (!matching) return { outcome: "not_found" };
    const providerId = providerOrderId(matching);
    if (!providerId) return { outcome: "not_found" };
    if (record.apliiq_order_id && record.apliiq_order_id !== providerId) {
      await repository.setProviderState({ squareOrderId: record.square_order_id, providerStatus: "id_mismatch", state: "attention", lastErrorCode: "provider_id_mismatch" });
      return { outcome: "attention" };
    }
    if (["submitting", "uncertain", "submitted_accepted"].includes(record.state)) {
      await repository.markSubmission({ squareOrderId: record.square_order_id, state: "submitted_reconciled", apliiqOrderId: providerId, providerStatus: String(matching.Status ?? "unknown") });
    }
    return applyProviderOrder(record, matching, undefined, deadline);
  }

  async function runScheduled() {
    if (config.enabled !== "true") return { queued: 0, reconciled: 0 };
    // Netlify schedules have a hard 30-second cap. Leave a cushion for the
    // platform response and never claim a new row once this bounded run is low.
    const deadline = Date.now() + 24_000;
    const inbound = await repository.listPendingSquareEvents();
    let inboundProcessed = 0;
    for (const event of inbound) {
      if (deadlineRemaining(deadline) < 2_000) break;
      try {
        const result = await processSquareEvent(event.square_event_id, deadline);
        if (result.outcome !== "duplicate" && result.outcome !== "disabled") inboundProcessed += 1;
      } catch { /* lease expiry makes a transient source failure retryable */ }
    }
    // Queued records originate in a webhook, but they are re-read and
    // revalidated before the first provider POST. No historic Square search is
    // performed, and a changed/refunded order is held instead of submitted.
    const queued = await repository.listQueued();
    let claimed = 0;
    for (const record of queued) {
      if (deadlineRemaining(deadline) < 2_000) break;
      if (withinHold(record.payment_created_at)) continue;
      try {
        const payment = await square.getPayment(record.square_payment_id, { timeoutMs: deadlineRemaining(deadline) });
        if (deadlineRemaining(deadline) < 1_000) break;
        const order = await square.getOrder(payment.order_id, { timeoutMs: deadlineRemaining(deadline) });
        const fresh = validatePaidSquareOrder({ payment, order, locationId: config.locationId, startAt: config.startAt, catalog });
        if (sha256(JSON.stringify(fresh.apliiqPayload)) !== record.payload_sha256) {
          await repository.setProviderState({ squareOrderId: record.square_order_id, providerStatus: "changed", state: "held", lastErrorCode: "payload_changed" });
          continue;
        }
        if (deadlineRemaining(deadline) < 2_000) break;
        const acquired = await repository.claimForSubmission(record.square_order_id);
        if (!acquired) continue;
        claimed += 1;
        await submitClaimed({ record: acquired, payload: fresh.apliiqPayload, deadline });
      } catch (error) {
        const code = error instanceof FulfillmentHold ? error.code : "square_revalidation_failed";
        await repository.setProviderState({ squareOrderId: record.square_order_id, providerStatus: "held", state: "held", lastErrorCode: code });
      }
    }
    const uncertain = await repository.listUncertain();
    if (uncertain.length === 0) return { inbound: inboundProcessed, queued: claimed, reconciled: 0 };
    let providerOrders = [];
    try {
      if (deadlineRemaining(deadline) < 2_000) return { inbound: inboundProcessed, queued: claimed, reconciled: 0 };
      providerOrders = await apliiq.listOrders({ timeoutMs: deadlineRemaining(deadline) });
    } catch { return { inbound: inboundProcessed, queued: claimed, reconciled: 0 }; }
    let reconciled = 0;
    for (const record of uncertain) {
      if (deadlineRemaining(deadline) < 2_000) break;
      try {
        const result = await reconcileProvider(record, providerOrders, deadline);
        if (!["not_found", "attention"].includes(result.outcome)) reconciled += 1;
      } catch { /* a later bounded run uses fresh provider and Square state */ }
      finally { await repository.touchReconciliationAttempt(record.square_order_id); }
    }
    return { inbound: inboundProcessed, queued: claimed, reconciled };
  }

  function shippedQuantities(providerOrder, expectedItems, callbackStatus) {
    const quantities = {};
    const seenShipmentLine = new Set();
    const providerShipped = ["shipped", "success"].includes(String(providerOrder?.Status ?? "").trim().toLowerCase());
    const callbackShipped = ["shipped", "success"].includes(String(callbackStatus ?? "").trim().toLowerCase());
    for (const notice of providerOrder?.SN ?? []) {
      if (typeof notice?.TrackingNumber !== "string" || !notice.TrackingNumber.trim()) continue;
      if (!providerShipped && !callbackShipped && !/shipped|success/i.test(String(notice.Helptext ?? ""))) continue;
      for (const item of notice?.Items ?? []) {
        const sku = item.SKU ?? item.sku;
        const quantity = Number(item.Quantity ?? item.quantity);
        const key = `${notice.TrackingNumber}\u0000${sku}`;
        if (typeof sku === "string" && Number.isInteger(quantity) && quantity > 0 && !seenShipmentLine.has(key)) {
          seenShipmentLine.add(key);
          quantities[sku] = (quantities[sku] ?? 0) + quantity;
        }
      }
    }
    // Only report supplier SKUs included in this order; unrelated provider data
    // cannot make an order look complete.
    const allow = new Set(expectedItems.map((item) => item.sku));
    return Object.fromEntries(Object.entries(quantities).filter(([sku]) => allow.has(sku)));
  }

  async function applyProviderOrder(record, providerOrder, callbackStatus, deadline) {
    const squareOrderId = record.square_order_id;
    const providerState = String(providerOrder.Status ?? "").trim().toLowerCase();
    if (TERMINAL_PROVIDER_STATES.has(providerState)) {
      await repository.setProviderState({ squareOrderId, providerStatus: providerState, state: "attention" });
      return { outcome: "attention" };
    }
    const items = record.submitted_items;
    const quantities = shippedQuantities(providerOrder, items, callbackStatus);
    const expectedBySku = items.reduce((sum, item) => ({ ...sum, [item.sku]: (sum[item.sku] ?? 0) + item.quantity }), {});
    const complete = Object.keys(expectedBySku).length > 0 && Object.entries(expectedBySku).every(([sku, quantity]) => (quantities[sku] ?? 0) >= quantity);
    const notices = (providerOrder?.SN ?? []).filter((notice) => typeof notice?.TrackingNumber === "string" && notice.TrackingNumber.trim());
    if (!notices.length) {
      if (["submitting", "uncertain", "submitted_processed", "submitted_accepted", "submitted_reconciled"].includes(record.state)) {
        await repository.setProviderState({ squareOrderId, providerStatus: providerState || "unknown", state: "submitted_reconciled" });
      }
      return { outcome: "pending" };
    }
    const latest = notices.at(-1);
    const trackingNumber = typeof latest.TrackingNumber === "string" ? latest.TrackingNumber : null;
    const carrier = typeof latest.Carrier === "string" && !latest.Carrier.startsWith("http") ? latest.Carrier : (typeof latest.Service === "string" ? latest.Service : null);
    const trackingUrl = typeof latest.Carrier === "string" && latest.Carrier.startsWith("https://")
      ? `${latest.Carrier}${encodeURIComponent(trackingNumber)}` : null;
    const priorTracking = Array.isArray(record.tracking) ? record.tracking.find((entry) => entry?.trackingNumber === trackingNumber && entry?.shippedAt) : null;
    const shippedAt = priorTracking?.shippedAt ?? now().toISOString();
    await repository.recordShipment({ squareOrderId, quantities, tracking: { carrier, trackingNumber, trackingUrl, shippedAt }, complete });
    await notifications.enqueueShipment({ recipient: record.customer_email, orderId: squareOrderId, orderNumber: record.apliiq_payload?.order_number || squareOrderId, carrier, trackingNumber, trackingUrl });
    if (!complete || !trackingNumber) return { outcome: "partial" };
    // Retrieve the latest order version immediately before the mutation. The
    // idempotency key makes a network retry safe; a version conflict remains
    // pending rather than overwriting newer Square state.
    const timeoutMs = deadline ? deadlineRemaining(deadline) : 8_000;
    if (timeoutMs < 1_000) return { outcome: "deferred" };
    const current = await square.getOrder(squareOrderId, { timeoutMs });
    const payment = await square.getPayment(record.square_payment_id, { timeoutMs: deadline ? deadlineRemaining(deadline) : 8_000 });
    const currentFulfillment = current.fulfillments?.find((fulfillment) => fulfillment.uid === record.square_fulfillment_uid);
    if (!currentFulfillment) {
      await repository.setProviderState({ squareOrderId, providerStatus: "shipment_missing", state: "attention", lastErrorCode: "square_fulfillment_missing" });
      return { outcome: "attention" };
    }
    try {
      // A previous successful Square update leaves this fulfillment COMPLETED.
      // Revalidate payment/order fields while treating that terminal state as
      // its original supported shipment state, then settle idempotently below.
      const orderForValidation = currentFulfillment.state === "COMPLETED"
        ? { ...current, fulfillments: current.fulfillments.map((fulfillment) => fulfillment.uid === currentFulfillment.uid ? { ...fulfillment, state: "PROPOSED" } : fulfillment) }
        : current;
      const fresh = validatePaidSquareOrder({ payment, order: orderForValidation, locationId: config.locationId, startAt: config.startAt, catalog });
      if (record.payload_sha256 && sha256(JSON.stringify(fresh.apliiqPayload)) !== record.payload_sha256) throw new FulfillmentHold("payload_changed");
    } catch (error) {
      const code = error instanceof FulfillmentHold ? error.code : "square_revalidation_failed";
      await repository.setProviderState({ squareOrderId, providerStatus: "attention", state: "attention", lastErrorCode: code });
      return { outcome: "attention" };
    }
    if (currentFulfillment.state === "COMPLETED") {
      await repository.markShipped({ squareOrderId });
      return { outcome: "already_shipped" };
    }
    await square.updateShipment({ order: current, fulfillmentUid: record.square_fulfillment_uid, tracking: { carrier, trackingNumber, trackingUrl, shippedAt, timeoutMs: deadline ? deadlineRemaining(deadline) : 8_000 } });
    await repository.markShipped({ squareOrderId });
    return { outcome: "shipped" };
  }

  async function receiveApliiqFulfillment({ providerOrderId: externalOrderId, callbackStatus }) {
    if (config.enabled !== "true") return { outcome: "disabled" };
    // The provider's callback docs call this `order_id`, which can be either
    // its internal OrderId or our StoreSystemOrderId. Join either form through
    // a verified provider record before accepting it as a Square order id.
    let record = await repository.getOrder(String(externalOrderId));
    const providerOrders = await apliiq.listOrders();
    let matching = record ? matchingProviderOrders(record, providerOrders)[0] : null;
    if (!record) {
      matching = Array.isArray(providerOrders)
        ? providerOrders.find((item) => providerOrderId(item) === String(externalOrderId)) : null;
      const storeSystemOrderId = matching?.StoreSystemOrderId;
      if (storeSystemOrderId === undefined || storeSystemOrderId === null) return { outcome: "ignored", code: "unknown_provider_order" };
      record = await repository.getOrder(String(storeSystemOrderId));
    }
    if (!record) return { outcome: "ignored", code: "unknown_store_order" };
    if (!matching) return { outcome: "ignored", code: "provider_order_not_found" };
    if (matchingProviderOrders(record, providerOrders).length !== 1) {
      await repository.setProviderState({ squareOrderId: record.square_order_id, providerStatus: "id_mismatch", state: "attention", lastErrorCode: "provider_join_ambiguous" });
      return { outcome: "attention" };
    }
    const providerId = providerOrderId(matching);
    if (!providerId) return { outcome: "ignored", code: "provider_order_not_found" };
    if (record.apliiq_order_id && record.apliiq_order_id !== providerId) {
      await repository.setProviderState({ squareOrderId: record.square_order_id, providerStatus: "id_mismatch", state: "attention", lastErrorCode: "provider_id_mismatch" });
      return { outcome: "attention" };
    }
    const result = await applyProviderOrder(record, matching, callbackStatus);
    return result;
  }

  async function processApliiqEvent(input) {
    const event = await repository.claimProviderEvent(input.eventId);
    if (!event) return { outcome: "duplicate" };
    try {
      const result = await receiveApliiqFulfillment(input);
      await repository.markProviderEventProcessed(input.eventId);
      return result;
    } catch (error) {
      await repository.noteProviderEventError(input.eventId);
      throw error;
    }
  }

  return { processSquarePayment, processSquareEvent, runScheduled, receiveApliiqFulfillment, processApliiqEvent, now };
}
