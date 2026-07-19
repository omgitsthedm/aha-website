// Best-effort in-process sliding-window rate limiter for unauthenticated public
// endpoints (feedback, magic-link request). Serverless instances are ephemeral
// and not shared, so this bounds bursts against a single warm instance rather
// than providing a global guarantee. A durable limiter (Netlify edge rate-limit
// rule or a Neon-backed counter) is the follow-up tracked in the Desktop
// checklist; this ships now because it is zero-infra and cannot break the flow.

interface Bucket {
  hits: number[];
}

const store = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number, windowMs: number) {
  // Amortized cleanup so the Map can't grow unbounded on a long-lived instance.
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

/**
 * @param key   stable identity (e.g. `feedback:${ip}` or `login:${ip}:${email}`)
 * @param limit max requests allowed within the window
 * @param windowMs sliding window length in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);
  const bucket = store.get(key) || { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    store.set(key, bucket);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  return { ok: true, retryAfterSeconds: 0 };
}

/** Extract the best client IP available behind Netlify's proxy. */
export function clientIp(req: Request): string {
  const nf = req.headers.get("x-nf-client-connection-ip");
  if (nf) return nf;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}
