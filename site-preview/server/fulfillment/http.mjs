import { boundedText } from '../http/body.mjs';
const MAX_WEBHOOK_BYTES = 131_072;

// Keep unsigned callbacks bounded before parsing, catalog reads, database work,
// or provider setup. The body remains intact for the provider's HMAC check.
export async function webhookBody(request) {
  try { return await boundedText(request, MAX_WEBHOOK_BYTES); }
  catch { return null; }
}
