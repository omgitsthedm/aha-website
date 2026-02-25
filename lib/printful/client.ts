const PRINTFUL_BASE_URL = "https://api.printful.com/v2";

interface PrintfulRequestOptions {
  method?: string;
  body?: Record<string, unknown>;
  storeId?: string;
}

// Simple rate limiter — Printful allows 120 req/min
let requestQueue: number[] = [];
const RATE_LIMIT = 120;
const RATE_WINDOW = 60000; // 60 seconds

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  requestQueue = requestQueue.filter((t) => now - t < RATE_WINDOW);

  if (requestQueue.length >= RATE_LIMIT) {
    const oldestInWindow = requestQueue[0];
    const waitTime = RATE_WINDOW - (now - oldestInWindow) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  requestQueue.push(Date.now());
}

export async function printfulRequest<T>(
  endpoint: string,
  options: PrintfulRequestOptions = {}
): Promise<T> {
  await waitForRateLimit();

  const { method = "GET", body, storeId } = options;
  const store = storeId || process.env.PRINTFUL_STORE_ID;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  if (store) {
    headers["X-PF-Store-Id"] = store;
  }

  const res = await fetch(`${PRINTFUL_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 429) {
    // Rate limited — wait and retry once
    const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
    await new Promise((resolve) =>
      setTimeout(resolve, retryAfter * 1000)
    );
    return printfulRequest(endpoint, options);
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      `Printful API error ${res.status}: ${JSON.stringify(error)}`
    );
  }

  return res.json();
}
