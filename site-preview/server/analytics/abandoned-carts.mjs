// Abandoned carts from the checkout table itself, not from browser analytics.
// A visit can quote several times (address or bag changes), so carts are
// grouped by PostHog session when one is known, otherwise by checkout.
//
// export abandonedCartStats(sql) → {
//   last7Days:  { carts, abandoned, completed },
//   last30Days: { carts, abandoned, completed },
//   recent: [{ checkoutId, createdAt, totalCents, state, posthogSessionId }]  // newest 50 abandoned
// }
// `sql` is the tagged-template query function used by the repositories.

function counts(row) {
  const carts = Number(row?.carts ?? 0);
  const completed = Number(row?.completed ?? 0);
  return { carts, completed, abandoned: Math.max(carts - completed, 0) };
}

export async function abandonedCartStats(sql) {
  const [week] = await sql`
    WITH carts AS (
      SELECT COALESCE(posthog_session_id, checkout_id) AS cart_key, bool_or(state = 'completed') AS done
      FROM aha_checkout_sessions
      WHERE created_at > now() - interval '7 days'
      GROUP BY 1
    )
    SELECT count(*) AS carts, count(*) FILTER (WHERE done) AS completed FROM carts
  `;
  const [month] = await sql`
    WITH carts AS (
      SELECT COALESCE(posthog_session_id, checkout_id) AS cart_key, bool_or(state = 'completed') AS done
      FROM aha_checkout_sessions
      WHERE created_at > now() - interval '30 days'
      GROUP BY 1
    )
    SELECT count(*) AS carts, count(*) FILTER (WHERE done) AS completed FROM carts
  `;
  const recent = await sql`
    SELECT checkout_id, created_at, total_cents, state, posthog_session_id FROM (
      SELECT DISTINCT ON (COALESCE(posthog_session_id, checkout_id))
             checkout_id, created_at, total_cents, state, posthog_session_id,
             bool_or(state = 'completed') OVER (PARTITION BY COALESCE(posthog_session_id, checkout_id)) AS done
      FROM aha_checkout_sessions
      WHERE created_at > now() - interval '30 days'
      ORDER BY COALESCE(posthog_session_id, checkout_id), created_at DESC, checkout_id DESC
    ) latest
    WHERE NOT done
    ORDER BY created_at DESC, checkout_id
    LIMIT 50
  `;
  return {
    last7Days: counts(week),
    last30Days: counts(month),
    recent: recent.map((row) => ({
      checkoutId: row.checkout_id,
      createdAt: new Date(row.created_at).toISOString(),
      totalCents: Number(row.total_cents),
      state: row.state,
      posthogSessionId: row.posthog_session_id ?? null,
    })),
  };
}
