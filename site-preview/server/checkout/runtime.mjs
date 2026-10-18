import { createCheckoutRepository } from "./repository.mjs";
import { createCheckoutService } from "./service.mjs";
import { createSquareCheckoutGateway } from "./square.mjs";
import { AHA_HOST, AHA_SITE_ID, requireProductionRequest } from "../fulfillment/runtime.mjs";
import { eligibleProviders } from "../analytics/marketing.mjs";

export { AHA_HOST, AHA_SITE_ID, requireProductionRequest };

function enabled(value) { return value === "true"; }
export function checkoutConfig(env) {
  return {
    enabled: enabled(env.get("AHA_CHECKOUT_ENABLED")),
    accessToken: env.get("AHA_SQUARE_ACCESS_TOKEN"),
    applicationId: env.get("AHA_SQUARE_APPLICATION_ID"),
    locationId: env.get("AHA_SQUARE_LOCATION_ID"),
    methods: {
      card: true,
      applePay: enabled(env.get("AHA_CHECKOUT_APPLE_PAY_ENABLED")),
      googlePay: enabled(env.get("AHA_CHECKOUT_GOOGLE_PAY_ENABLED")),
      cashAppPay: enabled(env.get("AHA_CHECKOUT_CASH_APP_PAY_ENABLED")),
      afterpay: enabled(env.get("AHA_CHECKOUT_AFTERPAY_ENABLED")),
      // Square gift cards (sold on Square's own eGift page) are on unless turned off.
      giftCard: env.get("AHA_CHECKOUT_GIFT_CARD_ENABLED") !== "false",
    },
  };
}
export function checkoutReady(config) {
  return Boolean(config.enabled && config.accessToken && config.applicationId && config.locationId);
}
export function allowedOrigin(request) {
  const origin = request.headers.get("origin");
  return origin === `https://${AHA_HOST}`;
}
export function createCheckoutRuntime({ database, env, catalog }) {
  const config = checkoutConfig(env);
  const repository = createCheckoutRepository(database);
  const unavailable = async () => { throw new Error("square unavailable"); };
  const square = config.accessToken ? createSquareCheckoutGateway({ accessToken: config.accessToken }) : { calculateOrder: unavailable, createOrder: unavailable, createPayment: unavailable, getOrder: unavailable, getPayment: unavailable };
  return { config, repository, service: createCheckoutService({ repository, square, config, catalog, eligibleProviders: eligibleProviders(env) }) };
}
