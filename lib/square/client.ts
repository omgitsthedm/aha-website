import { getCommerceEnvironment, getSquareBaseUrl } from "@/lib/commerce/runtime";

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
 * Square catalog descriptions can occasionally contain raw control characters.
 * Escape them only while inside JSON strings so one malformed description cannot
 * make the entire catalog response unreadable.
 */
export function parseSquareJson<T>(text: string): T {
  let inString = false;
  let escaped = false;
  let sanitized = "";

  for (const character of text) {
    if (!inString) {
      sanitized += character;
      if (character === '"') inString = true;
      continue;
    }

    if (escaped) {
      sanitized += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      sanitized += character;
      escaped = true;
      continue;
    }

    if (character === '"') {
      sanitized += character;
      inString = false;
      continue;
    }

    const code = character.charCodeAt(0);
    sanitized += code <= 0x1f
      ? `\\u${code.toString(16).padStart(4, "0")}`
      : character;
  }

  return JSON.parse(sanitized) as T;
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
  if (!endpoint.startsWith("/")) {
    throw new Error("Square endpoint must be a relative /v2 path.");
  }

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      `SQUARE_ACCESS_TOKEN is not configured for ${getCommerceEnvironment()} Square requests.`
    );
  }

  const { method = "GET", body, revalidate = 300 } = options;
  const url = `${getSquareBaseUrl()}${endpoint}`;
  const requestInit: RequestInit & { next?: { revalidate: number } } = {
    method,
    headers: {
      "Square-Version": process.env.SQUARE_API_VERSION || "2024-01-18",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    next: { revalidate },
  };

  const res = await fetchWithRetry(
    url,
    requestInit,
  );

  if (!res.ok) {
    const errorText = await res.text();
    const error = (() => {
      try { return parseSquareJson<unknown>(errorText); }
      catch { return {}; }
    })();
    throw new Error(
      `Square API error ${res.status}: ${JSON.stringify(error)}`
    );
  }

  const responseText = await res.text();
  try {
    return parseSquareJson<T>(responseText);
  } catch (error) {
    const safeToRetry = method === "GET" || endpoint.startsWith("/catalog/");
    if (!safeToRetry) throw error;

    const retry = await fetchWithRetry(url, {
      ...requestInit,
      headers: {
        ...requestInit.headers,
        "X-AHA-Cache-Retry": "1",
      },
    });
    if (!retry.ok) {
      throw new Error(`Square API retry error ${retry.status}.`);
    }
    return parseSquareJson<T>(await retry.text());
  }
}
