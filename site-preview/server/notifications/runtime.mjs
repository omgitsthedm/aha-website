import { orderStatusUrl } from "../orders/status.mjs";
import { createNotificationRepository } from "./repository.mjs";
import { createResendGateway } from "./resend.mjs";
import { createNotificationService } from "./service.mjs";
import { isSuppressed, unsubscribeLinks } from "./unsubscribe.mjs";

export function notificationConfig(env) {
  return { enabled: env.get("AHA_ORDER_EMAIL_ENABLED") === "true", apiKey: env.get("RESEND_API_KEY"), from: env.get("RESEND_FROM_EMAIL"), replyTo: env.get("RESEND_REPLY_TO") };
}
export function createNotificationRuntime({ database, env }) {
  const config = notificationConfig(env);
  const repository = createNotificationRepository(database);
  const unavailable = async () => { throw new Error("resend unavailable"); };
  const gateway = config.apiKey && config.from && config.replyTo ? createResendGateway({ apiKey: config.apiKey, from: config.from, replyTo: config.replyTo }) : { send: unavailable, listDomains: unavailable };
  return { config, repository, service: createNotificationService({ repository, gateway, config, orderLink: (orderId) => orderStatusUrl(orderId, env), unsubscribeLinks: (id) => unsubscribeLinks(id, env), suppressed: (email) => isSuppressed(database, email) }) };
}
