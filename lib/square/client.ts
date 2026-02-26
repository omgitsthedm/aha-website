const SQUARE_BASE_URL = "https://connect.squareup.com/v2";

// Fail fast if Square credentials are missing (server-side only)
if (typeof window === "undefined" && !process.env.SQUARE_ACCESS_TOKEN) {
  console.warn(
    "⚠ SQUARE_ACCESS_TOKEN is not set. Square API calls will fail."
  );
}

interface SquareRequestOptions {
  method?: string;
  body?: Record<string, unknown>;
  /** Override the default revalidation (300s). Use 0 for no-cache. */
  revalidate?: number;
}

/**
 * Retry with exponential backoff for rate-limited requests.
 * Square API allows 30 req/sec and returns 429 when exceeded.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit & { next?: { revalidate: number } },
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);

    if (res.status === 429 && attempt < maxRetries) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    return res;
  }

  // Should never reach here, but just in case
  return fetch(url, init);
}

export async function squareRequest<T>(
  endpoint: string,
  options: SquareRequestOptions = {}
): Promise<T> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "SQUARE_ACCESS_TOKEN is not configured. Cannot make Square API requests."
    );
  }

  const { method = "GET", body, revalidate = 300 } = options;

  const res = await fetchWithRetry(
    `${SQUARE_BASE_URL}${endpoint}`,
    {
      method,
      headers: {
        "Square-Version": process.env.SQUARE_API_VERSION || "2024-01-18",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      next: { revalidate },
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      `Square API error ${res.status}: ${JSON.stringify(error)}`
    );
  }

  return res.json();
}
