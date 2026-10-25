function asJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    ...row,
    submitted_items: asJson(row.submitted_items, []),
    apliiq_payload: asJson(row.apliiq_payload, {}),
    shipped_line_quantities: asJson(row.shipped_line_quantities, {}),
    tracking: asJson(row.tracking, []),
  };
}

/** Production repository. Every state transition that can authorize a POST is atomic. */
export function createNetlifyRepository(db) {
  async function one(query) { return normalizeRow((await query)[0]); }
  return {
    async upsertHold({ squareOrderId, squarePaymentId = null, state, lastErrorCode }) {
      return one(db.sql`
        INSERT INTO aha_fulfillment_orders (square_order_id, square_payment_id, state, last_error_code)
        VALUES (${squareOrderId}, ${squarePaymentId}, ${state}, ${lastErrorCode})
        ON CONFLICT (square_order_id) DO UPDATE SET
          last_error_code = EXCLUDED.last_error_code,
          updated_at = now()
        RETURNING *
      `);
    },
    async insertValidated(record) {
      return one(db.sql`
        INSERT INTO aha_fulfillment_orders (
          square_order_id, square_payment_id, square_fulfillment_uid, payment_created_at, customer_email,
          state, submitted_items, apliiq_payload, payload_sha256
        ) VALUES (
          ${record.squareOrderId}, ${record.squarePaymentId}, ${record.squareFulfillmentUid},
          ${record.paymentCreatedAt}, ${record.customerEmail}, ${record.state}, ${JSON.stringify(record.submittedItems)},
          ${JSON.stringify(record.apliiqPayload)}, ${record.payloadSha256}
        ) ON CONFLICT (square_order_id) DO UPDATE SET
          customer_email = COALESCE(aha_fulfillment_orders.customer_email, EXCLUDED.customer_email), updated_at = now()
        RETURNING *
      `);
    },
    async claimForSubmission(squareOrderId) {
      return one(db.sql`
        UPDATE aha_fulfillment_orders
        SET state = 'submitting', claimed_at = now(), attempt_count = attempt_count + 1, updated_at = now()
        WHERE square_order_id = ${squareOrderId} AND state = 'queued'
        RETURNING *
      `);
    },
    async releaseSubmissionClaim(squareOrderId) {
      return one(db.sql`
        UPDATE aha_fulfillment_orders
        SET state = 'queued', claimed_at = NULL, updated_at = now()
        WHERE square_order_id = ${squareOrderId} AND state = 'submitting'
        RETURNING *
      `);
    },
    async markSubmission({ squareOrderId, state, apliiqOrderId, providerStatus, lastErrorCode = null }) {
      return one(db.sql`
        UPDATE aha_fulfillment_orders
        SET state = ${state}, apliiq_order_id = COALESCE(${apliiqOrderId}, apliiq_order_id),
            provider_status = ${providerStatus}, last_error_code = ${lastErrorCode}, updated_at = now()
        WHERE square_order_id = ${squareOrderId}
        RETURNING *
      `);
    },
    async markUncertain({ squareOrderId, code }) {
      return one(db.sql`
        UPDATE aha_fulfillment_orders
        SET state = 'uncertain', last_error_code = ${code}, updated_at = now()
        WHERE square_order_id = ${squareOrderId}
        RETURNING *
      `);
    },
    async getOrder(squareOrderId) {
      return one(db.sql`SELECT * FROM aha_fulfillment_orders WHERE square_order_id = ${squareOrderId} LIMIT 1`);
    },
    async canIgnoreFailedPosReceipt({ squareOrderId, squarePaymentId }) {
      // One read-only snapshot: checkout/provider evidence or any active monitor
      // record wins over the POS exception. Unknown/NULL evidence fails closed.
      const rows = await db.sql`
        SELECT NOT EXISTS (
          SELECT 1 FROM aha_checkout_sessions
          WHERE square_order_id = ${squareOrderId} OR square_payment_id = ${squarePaymentId}
        ) AND NOT EXISTS (
          SELECT 1 FROM aha_fulfillment_events WHERE square_order_id = ${squareOrderId}
        ) AND NOT EXISTS (
          SELECT 1 FROM aha_fulfillment_orders f
          WHERE (f.square_order_id = ${squareOrderId} OR f.square_payment_id = ${squarePaymentId})
            AND (
              f.square_order_id = ${squareOrderId} AND f.square_payment_id = ${squarePaymentId}
              AND f.state = 'ignored' AND f.last_error_code IS NULL
              AND f.provider_status = 'non_shipping_receipt'
              AND f.apliiq_order_id IS NULL AND f.square_fulfillment_uid IS NULL
              AND f.payment_created_at IS NULL AND f.customer_email IS NULL
              AND f.attempt_count = 0 AND f.claimed_at IS NULL
              AND f.submitted_items = '[]'::jsonb AND f.apliiq_payload = '{}'::jsonb
              AND f.payload_sha256 IS NULL AND f.tracking = '[]'::jsonb
              AND f.shipped_line_quantities = '{}'::jsonb
              AND EXISTS (
                SELECT 1 FROM aha_admin_audit a
                WHERE a.target = f.square_order_id AND a.action = 'fulfillment.monitor_repaired'
                  AND a.detail_json->>'reason' = 'verified_failed_non_shipping_receipt'
                  AND a.detail_json->>'toState' = 'ignored'
              )
            ) IS NOT TRUE
        ) AS can_ignore
      `;
      return rows[0]?.can_ignore === true;
    },
    async listQueued() {
      return (await db.sql`SELECT * FROM aha_fulfillment_orders WHERE state = 'queued' ORDER BY created_at ASC LIMIT 8`).map(normalizeRow);
    },
    async listUncertain() {
      return (await db.sql`
        SELECT * FROM aha_fulfillment_orders
        WHERE state IN ('submitting', 'uncertain', 'submitted_processed', 'submitted_accepted', 'submitted_reconciled', 'shipped_partial', 'ready_to_ship')
        ORDER BY updated_at ASC LIMIT 8
      `).map(normalizeRow);
    },
    async ingestProviderEvent({ eventId, squareOrderId }) {
      await db.sql`
        INSERT INTO aha_fulfillment_events (provider_event_id, square_order_id)
        VALUES (${eventId}, ${squareOrderId}) ON CONFLICT (provider_event_id) DO NOTHING
      `;
    },
    async claimProviderEvent(eventId) {
      return one(db.sql`
        UPDATE aha_fulfillment_events
        SET lease_expires_at = now() + interval '90 seconds'
        WHERE provider_event_id = ${eventId} AND processed_at IS NULL
          AND (lease_expires_at IS NULL OR lease_expires_at < now())
        RETURNING *
      `);
    },
    async markProviderEventProcessed(eventId) {
      await db.sql`UPDATE aha_fulfillment_events SET processed_at = now(), lease_expires_at = NULL WHERE provider_event_id = ${eventId}`;
    },
    async noteProviderEventError(eventId) {
      await db.sql`UPDATE aha_fulfillment_events SET lease_expires_at = NULL WHERE provider_event_id = ${eventId}`;
    },
    async ingestSquareEvent({ eventId, paymentId, eventCreatedAt = null }) {
      return one(db.sql`
        INSERT INTO aha_fulfillment_square_events (square_event_id, square_payment_id, event_created_at)
        VALUES (${eventId}, ${paymentId}, ${eventCreatedAt})
        ON CONFLICT (square_event_id) DO UPDATE SET updated_at = now()
        RETURNING *
      `);
    },
    async claimSquareEvent(eventId) {
      return one(db.sql`
        UPDATE aha_fulfillment_square_events
        SET lease_expires_at = now() + interval '90 seconds', attempt_count = attempt_count + 1, updated_at = now()
        WHERE square_event_id = ${eventId} AND processed_at IS NULL
          AND (lease_expires_at IS NULL OR lease_expires_at < now())
        RETURNING *
      `);
    },
    async listPendingSquareEvents() {
      return (await db.sql`
        SELECT * FROM aha_fulfillment_square_events
        WHERE processed_at IS NULL AND (lease_expires_at IS NULL OR lease_expires_at < now())
        ORDER BY updated_at ASC, received_at ASC LIMIT 8
      `).map(normalizeRow);
    },
    async markSquareEventProcessed(eventId) {
      await db.sql`
        UPDATE aha_fulfillment_square_events
        SET processed_at = now(), lease_expires_at = NULL, last_error_code = NULL, updated_at = now()
        WHERE square_event_id = ${eventId}
      `;
    },
    async noteSquareEventError(eventId, code) {
      await db.sql`
        UPDATE aha_fulfillment_square_events
        SET last_error_code = ${code}, updated_at = now()
        WHERE square_event_id = ${eventId}
      `;
    },
    async touchReconciliationAttempt(squareOrderId) {
      await db.sql`UPDATE aha_fulfillment_orders SET updated_at = now() WHERE square_order_id = ${squareOrderId}`;
    },
    async setProviderState({ squareOrderId, providerStatus, state, lastErrorCode = null }) {
      return one(db.sql`
        UPDATE aha_fulfillment_orders SET provider_status = ${providerStatus}, state = ${state}, last_error_code = ${lastErrorCode}, updated_at = now()
        WHERE square_order_id = ${squareOrderId} RETURNING *
      `);
    },
    async recordShipment({ squareOrderId, quantities, tracking, complete }) {
      return one(db.sql`
        UPDATE aha_fulfillment_orders
        SET shipped_line_quantities = ${JSON.stringify(quantities)},
            tracking = tracking || ${JSON.stringify([tracking])}::jsonb,
            state = ${complete ? "ready_to_ship" : "shipped_partial"}, updated_at = now()
        WHERE square_order_id = ${squareOrderId} RETURNING *
      `);
    },
    async markShipped({ squareOrderId }) {
      return one(db.sql`
        UPDATE aha_fulfillment_orders SET state = 'shipped', provider_status = 'shipped', updated_at = now()
        WHERE square_order_id = ${squareOrderId} RETURNING *
      `);
    },
    async counts() {
      const rows = await db.sql`SELECT state, count(*)::int AS count FROM aha_fulfillment_orders GROUP BY state`;
      return Object.fromEntries(rows.map((row) => [row.state, Number(row.count)]));
    },
    async attentionRows() {
      return (await db.sql`
        SELECT square_order_id, state, last_error_code, apliiq_order_id, provider_status
        FROM aha_fulfillment_orders
        WHERE state IN ('held', 'attention', 'uncertain', 'submitted_accepted') OR last_error_code IS NOT NULL
        ORDER BY updated_at DESC LIMIT 20
      `).map((row) => ({
        orderId: row.square_order_id,
        state: row.state,
        error: row.last_error_code,
        providerOrderId: row.apliiq_order_id,
        providerStatus: row.provider_status,
      }));
    },
  };
}
