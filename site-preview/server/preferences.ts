import { getDatabase } from "@netlify/database";
import {
  body,
  emailValue,
  failure,
  HttpError,
  json,
  production,
  type Runtime,
} from "./runtime.ts";
export async function unsubscribeInDatabase(
  sql: ReturnType<typeof getDatabase>["sql"],
  email: string,
) {
  await sql`WITH pref AS (
 INSERT INTO aha_marketing_preferences(email,consent,source) VALUES(${email},false,'website-unsubscribe')
 ON CONFLICT(email) DO UPDATE SET consent=false,updated_at=now(),source='website-unsubscribe' RETURNING email),
 subscriber AS (UPDATE email_subscribers SET consent=false WHERE email IN (SELECT email FROM pref))
 INSERT INTO abandoned_carts(email,items_json,subtotal,unsubscribed) VALUES(${email},'[]'::jsonb,0,true)
 ON CONFLICT(email) DO UPDATE SET unsubscribed=true,updated_at=now()`;
}
export async function subscribeInDatabase(
  sql: ReturnType<typeof getDatabase>["sql"],
  email: string,
) {
  // An old/retried signup event can never undo an unsubscribe. Rejoining requires verified consent.
  await sql`WITH pref AS (
 INSERT INTO aha_marketing_preferences(email,consent,source) VALUES(${email},true,'netlify-newsletter-2026')
 ON CONFLICT(email) DO NOTHING RETURNING email)
 INSERT INTO email_subscribers(email,consent,source) SELECT email,true,'netlify-newsletter-2026' FROM pref
 ON CONFLICT(email) DO NOTHING`;
}
export async function unsubscribe(
  request: Request,
  context: Runtime,
  sqlFactory = () => getDatabase().sql,
) {
  try {
    const input = await body(request);
    const email = emailValue(input.email);
    if (!email) throw new HttpError(400, "Enter a valid email address.");
    if (!production(context, request)) return json({ ok: true, preview: true });
    await unsubscribeInDatabase(sqlFactory(), email);
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
