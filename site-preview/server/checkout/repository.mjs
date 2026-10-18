function json(value) { return typeof value === "string" ? JSON.parse(value) : value; }
function row(value) { return value ? { ...value, cart_json: json(value.cart_json), shipping_address_json: json(value.shipping_address_json), order_payload_json: json(value.order_payload_json), ...(value.marketing_json === undefined ? {} : { marketing_json: json(value.marketing_json) }) } : null; }

export function createCheckoutRepository(db) {
  async function one(query) { return row((await query)[0]); }
  return {
    async create(record) {
      return one(db.sql`
        INSERT INTO aha_checkout_sessions (
          checkout_id, token_sha256, state, currency, cart_json, shipping_address_json, order_payload_json,
          subtotal_cents, shipping_cents, tax_cents, total_cents, tax_label, order_idempotency_key, expires_at,
          posthog_distinct_id, posthog_session_id
        ) VALUES (
          ${record.checkoutId}, ${record.tokenHash}, 'quoted', ${record.currency}, ${JSON.stringify(record.cart)},
          ${JSON.stringify(record.address)}, ${JSON.stringify(record.orderPayload)}, ${record.subtotalCents},
          ${record.shippingCents}, ${record.taxCents}, ${record.totalCents}, ${record.taxLabel},
          ${record.orderIdempotencyKey}, ${record.expiresAt},
          ${record.analytics?.distinctId ?? null}, ${record.analytics?.sessionId ?? null}
        ) RETURNING *
      `);
    },
    // This is deliberately a second, optional write. Netlify must apply the
    // additive migration before attribution becomes durable; until then a
    // checkout still has to price and pay normally.
    async saveMarketing({ checkoutId, context }) {
      try {
        return await one(db.sql`
          UPDATE aha_checkout_sessions
          SET marketing_json = ${JSON.stringify(context)},
              updated_at = CASE WHEN state = 'completed' THEN updated_at ELSE now() END
          WHERE checkout_id = ${checkoutId} RETURNING *
        `);
      } catch { return null; }
    },
    async get(checkoutId) { return one(db.sql`SELECT * FROM aha_checkout_sessions WHERE checkout_id = ${checkoutId} LIMIT 1`); },
    async cancelUnclaimedRecovery({ checkoutId, tokenHash }) {
      return one(db.sql`
        UPDATE aha_checkout_sessions
        SET state = 'failed', processing_lease_expires_at = NULL, last_error_code = 'payment_not_started', updated_at = now()
        WHERE checkout_id = ${checkoutId} AND token_sha256 = ${tokenHash} AND state = 'quoted'
        RETURNING *
      `);
    },
    async closeExpiredUnpaid({ checkoutId, tokenHash }) {
      return one(db.sql`
        UPDATE aha_checkout_sessions
        SET state = 'failed', processing_lease_expires_at = NULL, last_error_code = 'payment_not_started', updated_at = now()
        WHERE checkout_id = ${checkoutId} AND token_sha256 = ${tokenHash} AND state IN ('processing', 'unknown')
          AND (processing_lease_expires_at IS NULL OR processing_lease_expires_at < now())
          AND payment_submission_started_at IS NULL
        RETURNING *
      `);
    },
    async claim({ checkoutId, tokenHash, clientIdempotencyKey }) {
      return one(db.sql`
        UPDATE aha_checkout_sessions
        SET state = 'processing', payment_idempotency_key = ${clientIdempotencyKey},
            processing_lease_expires_at = now() + interval '90 seconds', updated_at = now(), last_error_code = NULL
        WHERE checkout_id = ${checkoutId} AND token_sha256 = ${tokenHash} AND expires_at > now()
          AND (state = 'quoted' OR (state = 'processing' AND payment_idempotency_key = ${clientIdempotencyKey} AND processing_lease_expires_at < now()))
        RETURNING *
      `);
    },
    async releaseClaim({ checkoutId, code }) {
      return one(db.sql`
        UPDATE aha_checkout_sessions SET state = 'quoted', processing_lease_expires_at = NULL, last_error_code = ${code}, updated_at = now()
        WHERE checkout_id = ${checkoutId} AND state = 'processing' AND square_order_id IS NULL
        RETURNING *
      `);
    },
    async saveOrder({ checkoutId, orderId }) {
      return one(db.sql`
        UPDATE aha_checkout_sessions SET square_order_id = ${orderId}, updated_at = now()
        WHERE checkout_id = ${checkoutId} AND state = 'processing' AND square_order_id IS NULL
          AND processing_lease_expires_at > now()
        RETURNING *
      `);
    },
    async markPaymentSubmissionStarted({ checkoutId, orderId }) {
      return one(db.sql`
        UPDATE aha_checkout_sessions
        SET payment_submission_started_at = now(), updated_at = now()
        WHERE checkout_id = ${checkoutId} AND state = 'processing' AND square_order_id = ${orderId}
          AND processing_lease_expires_at > now() AND payment_submission_started_at IS NULL
        RETURNING *
      `);
    },
    async complete({ checkoutId, orderId, paymentId, receiptUrl = null }) {
      return one(db.sql`
        UPDATE aha_checkout_sessions SET state = 'completed', square_order_id = ${orderId}, square_payment_id = ${paymentId}, square_receipt_url = ${receiptUrl},
          processing_lease_expires_at = NULL, last_error_code = NULL, updated_at = now()
        WHERE checkout_id = ${checkoutId} RETURNING *
      `);
    },
    async fail({ checkoutId, code }) {
      return one(db.sql`
        UPDATE aha_checkout_sessions SET state = 'failed', processing_lease_expires_at = NULL, last_error_code = ${code}, updated_at = now()
        WHERE checkout_id = ${checkoutId} AND state = 'processing' RETURNING *
      `);
    },
    async unknown({ checkoutId, code, orderId = null }) {
      return one(db.sql`
        UPDATE aha_checkout_sessions SET state = 'unknown', square_order_id = COALESCE(${orderId}, square_order_id), processing_lease_expires_at = NULL, last_error_code = ${code}, updated_at = now()
        WHERE checkout_id = ${checkoutId} AND state = 'processing' RETURNING *
      `);
    },
    async attention({ checkoutId, code }) {
      return one(db.sql`
        UPDATE aha_checkout_sessions
        SET state = 'unknown', processing_lease_expires_at = NULL, last_error_code = ${code}, updated_at = now()
        WHERE checkout_id = ${checkoutId} AND state IN ('processing', 'unknown')
          AND payment_submission_started_at IS NOT NULL
        RETURNING *
      `);
    },
  };
}
