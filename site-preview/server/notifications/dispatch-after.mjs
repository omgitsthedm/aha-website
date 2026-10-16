/**
 * Send queued order emails as soon as a webhook changes order state, so the
 * hourly scheduled dispatcher is only a safety net and the database can sleep
 * between orders. Runs after the response when the platform supports
 * waitUntil; never throws into the webhook.
 */
export function dispatchAfterResponse(notifications, context, limit = 2) {
  const pending = Promise.resolve()
    .then(() => notifications.service.dispatch(limit))
    .catch(() => null);
  if (typeof context?.waitUntil === "function") {
    context.waitUntil(pending);
    return Promise.resolve(null);
  }
  return pending;
}
