import { createApliiqGateway } from "./apliiq.mjs";
import { createNetlifyRepository } from "./repository.mjs";
import { createFulfillmentService } from "./service.mjs";
import { createSquareGateway } from "./square.mjs";
import { createNotificationRuntime } from "../notifications/runtime.mjs";

export const AHA_SITE_ID = "275b4115-16bf-42fb-9b36-6bce9bb93608";
export const AHA_HOST = "afterhoursagenda.com";

export function environmentConfig(env) {
  return {
    enabled: env.get("AHA_FULFILLMENT_ENABLED") ?? "false",
    startAt: env.get("AHA_FULFILLMENT_START_AT"),
    locationId: env.get("AHA_SQUARE_LOCATION_ID"),
    merchantId: env.get("AHA_SQUARE_MERCHANT_ID"),
    squareSignatureKey: env.get("AHA_SQUARE_WEBHOOK_SIGNATURE_KEY"),
    adminToken: env.get("AHA_FULFILLMENT_ADMIN_TOKEN"),
    apliiqSharedSecret: env.get("AHA_APLIIQ_SHARED_SECRET"),
    // Minutes between payment and Apliiq submission (0 submits at once).
    holdMinutes: env.get("AHA_FULFILLMENT_HOLD_MINUTES") ?? "60",
  };
}

export function requireProductionRequest(request, context) {
  const url = new URL(request.url);
  return context?.site?.id === AHA_SITE_ID && context?.deploy?.context === "production" && url.protocol === "https:" && url.hostname === AHA_HOST;
}

export function createRuntime({ database, env, catalog }) {
  const config = environmentConfig(env);
  const repository = createNetlifyRepository(database);
  const notifications = createNotificationRuntime({ database, env });
  const squareToken = env.get("AHA_SQUARE_ACCESS_TOKEN");
  const apliiqApiKey = env.get("AHA_APLIIQ_API_KEY");
  const unavailable = (provider) => async () => { throw new Error(`${provider} is not configured.`); };
  return {
    config,
    repository,
    service: createFulfillmentService({
      repository,
      square: squareToken ? createSquareGateway({ accessToken: squareToken }) : { getPayment: unavailable("Square"), getOrder: unavailable("Square"), updateShipment: unavailable("Square") },
      apliiq: apliiqApiKey && config.apliiqSharedSecret
        ? createApliiqGateway({ apiKey: apliiqApiKey, sharedSecret: config.apliiqSharedSecret })
        : { createOrder: unavailable("Apliiq"), getOrder: unavailable("Apliiq"), listOrders: unavailable("Apliiq") },
      notifications: notifications.service,
      config,
      catalog,
    }),
    notifications,
  };
}
