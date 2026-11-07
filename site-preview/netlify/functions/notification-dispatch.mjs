import { getDatabase } from "@netlify/database";
import { currentCatalog } from "../../server/catalog/current.mjs";
import { AHA_SITE_ID } from "../../server/fulfillment/runtime.mjs";
import { queueCustomerEmails } from "../../server/notifications/customer-emails.mjs";
import { createNotificationRuntime } from "../../server/notifications/runtime.mjs";
import { trackWorker } from "../../server/operations/worker.mjs";

export default async function notificationDispatch(_request, context) {
  if (context?.site?.id !== AHA_SITE_ID || context?.deploy?.context !== "production") return;
  const database = getDatabase();
  await trackWorker(database, "notifications", async () => {
    const runtime = createNotificationRuntime({ database, env: Netlify.env });
    let recoveryFailed = false;
    // Bag reminders and review requests that are due (server/notifications/customer-emails.mjs).
    if (runtime.config.enabled) {
      try { await runtime.confirmations.recoverMissing(); } catch { recoveryFailed = true; console.error(JSON.stringify({ event: "order_confirmation_recovery_failed" })); }
      try {
        const { products } = await currentCatalog();
        await queueCustomerEmails({ db: database, service: runtime.service, products, env: Netlify.env });
      } catch (error) {
        console.error(JSON.stringify({ event: "customer_emails_queue_error", name: error?.name ?? "Error", code: error?.code ?? null }));
      }
    }
    await runtime.service.dispatch(20);
    if (recoveryFailed) throw new Error("order_confirmation_recovery_failed");
  });
}
// Webhooks send new order emails immediately (dispatch-after.mjs). This quarter-hourly
// run retries deferred rows and sends the bag reminders and review requests
// that have come due, so Netlify Database can sleep between orders.
export const config = { schedule: "0,15,30,45 * * * *" };
