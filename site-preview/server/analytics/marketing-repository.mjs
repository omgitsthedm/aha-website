function json(value, fallback = {}) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return fallback; } }
  return value;
}

function row(value) { return value ? { ...value, marketing_json: json(value.marketing_json), cart_json: json(value.cart_json, []), payload_json: json(value.payload_json) } : null; }

/** Durable, provider-scoped purchase outbox. A provider can see each Square order once. */
export function createMarketingRepository(db) {
  async function one(query) { return row((await query)[0]); }
  return {
    async getCompletedCheckout(checkoutId) {
      return one(db.sql`SELECT * FROM aha_checkout_sessions WHERE checkout_id = ${checkoutId} AND state = 'completed' LIMIT 1`);
    },
    async getCompletedCheckoutByPayment(paymentId) {
      return one(db.sql`SELECT * FROM aha_checkout_sessions WHERE square_payment_id = ${paymentId} AND state = 'completed' LIMIT 1`);
    },
    async enqueue({ provider, squareOrderId, checkoutId, payload }) {
      return one(db.sql`
        INSERT INTO aha_marketing_purchase_outbox (provider, square_order_id, checkout_id, payload_json)
        VALUES (${provider}, ${squareOrderId}, ${checkoutId}, ${JSON.stringify(payload)})
        ON CONFLICT (provider, square_order_id) DO UPDATE SET updated_at = now()
        RETURNING *
      `);
    },
    async claim(limit) {
      return (await db.sql`
        WITH expired AS (
          UPDATE aha_marketing_purchase_outbox
          SET state = 'attention', lease_expires_at = NULL, last_error_code = 'delivery_attempt_limit', updated_at = now()
          WHERE state = 'sending' AND lease_expires_at < now() AND attempt_count >= 5
        ), candidates AS (
          SELECT id FROM aha_marketing_purchase_outbox
          WHERE state IN ('pending', 'sending') AND attempt_count < 5 AND next_attempt_at <= now()
            AND (lease_expires_at IS NULL OR lease_expires_at < now())
          ORDER BY created_at ASC
          LIMIT ${Math.max(1, Math.min(20, Number(limit) || 8))}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE aha_marketing_purchase_outbox outbox
        SET state = 'sending', lease_expires_at = now() + interval '90 seconds',
            attempt_count = attempt_count + 1, updated_at = now()
        FROM candidates
        WHERE outbox.id = candidates.id
        RETURNING outbox.*
      `).map(row);
    },
    async markSent({ id, attemptCount }) {
      return one(db.sql`UPDATE aha_marketing_purchase_outbox SET state = 'sent', sent_at = now(), lease_expires_at = NULL, last_error_code = NULL, updated_at = now() WHERE id = ${id} AND state = 'sending' AND attempt_count = ${attemptCount} AND lease_expires_at > now() RETURNING *`);
    },
    async disable({ id, attemptCount, code }) {
      return one(db.sql`UPDATE aha_marketing_purchase_outbox SET state = 'disabled', lease_expires_at = NULL, last_error_code = ${code}, updated_at = now() WHERE id = ${id} AND state = 'sending' AND attempt_count = ${attemptCount} AND lease_expires_at > now() RETURNING *`);
    },
    async retryOrAttention({ id, attemptCount, code, retryAfterMinutes }) {
      return one(db.sql`
        UPDATE aha_marketing_purchase_outbox
        SET state = CASE WHEN attempt_count >= 5 THEN 'attention' ELSE 'pending' END,
            next_attempt_at = CASE WHEN attempt_count >= 5 THEN next_attempt_at ELSE now() + (${Math.max(1, Math.min(60, Number(retryAfterMinutes) || 1))} * interval '1 minute') END,
            lease_expires_at = NULL, last_error_code = ${code}, updated_at = now()
        WHERE id = ${id} AND state = 'sending' AND attempt_count = ${attemptCount} AND lease_expires_at > now()
        RETURNING *
      `);
    },
  };
}
