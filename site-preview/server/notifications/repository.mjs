function json(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}
function row(value) { return value ? { ...value, payload_json: json(value.payload_json, {}) } : null; }

/** Durable, idempotent transactional-only mail outbox for the active storefront. */
export function createNotificationRepository(db) {
  async function one(query) { return row((await query)[0]); }
  return {
    async enqueue({ dedupeKey, kind, recipient, payload }) {
      return one(db.sql`
        INSERT INTO aha_order_notifications (dedupe_key, kind, recipient, payload_json)
        VALUES (${dedupeKey}, ${kind}, ${recipient}, ${JSON.stringify(payload)})
        ON CONFLICT (dedupe_key) DO UPDATE SET updated_at = now()
        RETURNING *
      `);
    },
    async claim(limit = 8) {
      // A worker can end after the provider request but before persistence. A
      // stale lease safely retries with the same Resend idempotency key; after
      // the bounded retry budget it becomes operator attention instead.
      await db.sql`
        UPDATE aha_order_notifications
        SET state = 'attention', lease_expires_at = NULL, last_error_code = 'resend_delivery_unknown', updated_at = now()
        WHERE (state = 'sending' AND lease_expires_at < now() AND attempt_count >= 5)
           OR (state IN ('pending', 'sending') AND attempt_count > 0
               AND first_attempt_at < now() - interval '23 hours')
      `;
      return (await db.sql`
        WITH candidates AS (
          SELECT id FROM aha_order_notifications
          WHERE ((state = 'pending' AND next_attempt_at <= now())
                 OR (state = 'sending' AND lease_expires_at < now() AND attempt_count < 5))
            AND NOT (attempt_count > 0 AND first_attempt_at < now() - interval '23 hours')
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        UPDATE aha_order_notifications AS notification
        SET state = 'sending', attempt_count = notification.attempt_count + 1,
            first_attempt_at = COALESCE(notification.first_attempt_at, now()),
            lease_expires_at = now() + interval '5 minutes', updated_at = now()
        FROM candidates
        WHERE notification.id = candidates.id
        RETURNING notification.*
      `).map(row);
    },
    async markSent({ id, providerMessageId }) {
      return one(db.sql`
        UPDATE aha_order_notifications
        SET state = 'sent', provider_message_id = ${providerMessageId}, lease_expires_at = NULL,
            last_error_code = NULL, sent_at = now(), updated_at = now()
        WHERE id = ${id} AND state = 'sending'
        RETURNING *
      `);
    },
    // An address that unsubscribed after the email was queued: done, nothing sent.
    async markSuppressed({ id }) {
      return one(db.sql`
        UPDATE aha_order_notifications
        SET state = 'sent', provider_message_id = NULL, lease_expires_at = NULL,
            last_error_code = 'suppressed', sent_at = now(), updated_at = now()
        WHERE id = ${id} AND state = 'sending'
        RETURNING *
      `);
    },
    async retryOrAttention({ id, code }) {
      return one(db.sql`
        UPDATE aha_order_notifications
        SET state = CASE WHEN attempt_count >= 5
                                OR (attempt_count > 0 AND first_attempt_at < now() - interval '23 hours')
                           THEN 'attention' ELSE 'pending' END,
            lease_expires_at = NULL,
            next_attempt_at = CASE WHEN attempt_count >= 5
                                        OR (attempt_count > 0 AND first_attempt_at < now() - interval '23 hours')
                                   THEN next_attempt_at ELSE now() + interval '5 minutes' END,
            last_error_code = ${code}, updated_at = now()
        WHERE id = ${id} AND state = 'sending'
        RETURNING *
      `);
    },
    async counts() {
      const rows = await db.sql`SELECT state, count(*)::int AS count FROM aha_order_notifications GROUP BY state`;
      return Object.fromEntries(rows.map((value) => [value.state, Number(value.count)]));
    },
  };
}
