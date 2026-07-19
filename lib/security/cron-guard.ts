// Defense-in-depth for Netlify scheduled functions. Per Netlify docs, scheduled
// functions cannot be invoked by URL on published deploys — the scheduler
// invokes them with a POST whose JSON body carries a `next_run` timestamp. This
// guard admits exactly that documented invocation (so it never breaks the real
// schedule) plus an explicit CRON_SECRET header for authorized manual runs, and
// denies anything else. It is intentionally a no-op for legitimate traffic.

export async function isScheduledInvocation(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization") || req.headers.get("x-cron-secret") || "";
    if (header === `Bearer ${secret}` || header === secret) return true;
  }
  if (req.method === "POST") {
    try {
      const body = await req.clone().json();
      if (body && typeof (body as Record<string, unknown>).next_run !== "undefined") return true;
    } catch {
      // Non-JSON / empty body — fall through to deny.
    }
  }
  return false;
}
