export const SITE_ID = "275b4115-16bf-42fb-9b36-6bce9bb93608";
export interface Runtime {
  site: { id?: string };
  deploy: { context?: string; published?: boolean };
}
export function production(context: Runtime, request?: Request) {
  return (
    context.site.id === SITE_ID &&
    context.deploy.context === "production" &&
    context.deploy.published === true &&
    (!request || new URL(request.url).hostname === "afterhoursagenda.com")
  );
}
export function env(name: string): string {
  return typeof Netlify !== "undefined"
    ? Netlify.env.get(name) || ""
    : process.env[name] || "";
}
export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, noarchive",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export async function body(
  request: Request,
  limit = 4096,
): Promise<Record<string, unknown>> {
  if (request.method !== "POST") throw new HttpError(405, "Use POST.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Use a JSON request.");
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin)
    throw new HttpError(403, "Use this website to submit the request.");
  const reader = request.body?.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  if (reader) {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      chunks.push(next.value);
    }
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new HttpError(400, "Check your request and try again.");
  }
}
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function failure(error: unknown) {
  return error instanceof HttpError
    ? json({ error: error.message }, error.status)
    : json(
        {
          error:
            "This service is temporarily unavailable. Email info@afterhoursagenda.com for help.",
        },
        503,
      );
}
export const emailValue = (v: unknown) =>
  typeof v === "string" &&
  v.length <= 160 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
    ? v.trim().toLowerCase()
    : null;
export function trackingUrl(value: unknown) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      [
        "ups.com",
        "usps.com",
        "fedex.com",
        "dhl.com",
        "dhlglobalmail.com",
        "apliiq.com",
      ].some(
        (host) => url.hostname === host || url.hostname.endsWith("." + host),
      )
      ? url.href
      : null;
  } catch {
    return null;
  }
}
