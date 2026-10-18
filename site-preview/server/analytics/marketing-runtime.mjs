import { createSquareCheckoutGateway } from "../checkout/square.mjs";
import { checkoutConfig } from "../checkout/runtime.mjs";
import { createGoogleDelivery, createMarketingService, createMetaDelivery, deliveryConfig } from "./marketing.mjs";
import { createMarketingRepository } from "./marketing-repository.mjs";

function paidForSession(payment, session, locationId) {
  return payment?.status === "COMPLETED" && payment?.id === session.square_payment_id
    && payment.order_id === session.square_order_id && payment.location_id === locationId
    && payment.amount_money?.currency === session.currency && payment.amount_money?.amount === session.total_cents;
}

export function createMarketingRuntime({ database, env, fetchImpl = fetch }) {
  const config = deliveryConfig(env);
  const repository = createMarketingRepository(database);
  const deliveries = {
    google: createGoogleDelivery({ ...config.google, fetchImpl }),
    meta: createMetaDelivery({ ...config.meta, fetchImpl }),
  };
  const service = createMarketingService({ repository, deliveries });
  const checkout = checkoutConfig(env);
  return {
    repository, service, deliveries,
    async queueCheckout(checkoutId) {
      const session = await repository.getCompletedCheckout(checkoutId);
      return session ? service.enqueue(session) : { queued: 0 };
    },
    async queueSquarePayment(paymentId) {
      if (!checkout.accessToken || !checkout.locationId) return { queued: 0 };
      const session = await repository.getCompletedCheckoutByPayment(paymentId);
      if (!session) return { queued: 0 };
      try {
        const payment = await createSquareCheckoutGateway({ accessToken: checkout.accessToken }).getPayment(paymentId);
        return paidForSession(payment, session, checkout.locationId) ? service.enqueue(session) : { queued: 0 };
      } catch { return { queued: 0 }; }
    },
  };
}
