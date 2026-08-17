import { createApliiqAuthorization } from "./auth";
import type {
  ApliiqClient,
  ApliiqCredentials,
  ApliiqFetch,
  ApliiqRequestOptions,
  ApliiqResponse,
} from "./types";

export const APLIIQ_API_BASE_URL = "https://api.apliiq.com/v1";

export interface CreateApliiqClientOptions extends ApliiqCredentials {
  /** Inject in tests; production callers should pass the platform fetch. */
  fetch?: ApliiqFetch;
  /** Inject to make the signature timestamp deterministic in tests. */
  clock?: () => Date;
  /** Inject to make the request nonce deterministic in tests. */
  nonce?: () => string;
  baseUrl?: string;
}

function parseJsonResponse<T>(text: string, status: number): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Apliiq API returned invalid JSON (HTTP ${status}).`);
  }
}

export class ApliiqHttpError extends Error {
  constructor(public readonly status: number) {
    super(`Apliiq API request failed (HTTP ${status}).`);
    this.name = "ApliiqHttpError";
  }
}

function joinEndpoint(baseUrl: string, endpoint: string): string {
  if (!endpoint.startsWith("/") || endpoint.startsWith("//")) {
    throw new Error("Apliiq endpoint must be a relative path beginning with one '/'.");
  }
  return `${baseUrl.replace(/\/$/, "")}${endpoint}`;
}

/**
 * Thin, non-retrying Apliiq HTTP client. A POST may have been accepted before
 * a connection fails, so automatic retries could submit a duplicate order.
 */
export function createApliiqClient({
  apiKey,
  sharedSecret,
  fetch: fetchImpl = globalThis.fetch,
  clock = () => new Date(),
  nonce = () => crypto.randomUUID(),
  baseUrl = APLIIQ_API_BASE_URL,
}: CreateApliiqClientOptions): ApliiqClient {
  if (typeof fetchImpl !== "function") {
    throw new Error("Apliiq requires a fetch implementation.");
  }
  if (baseUrl !== APLIIQ_API_BASE_URL) {
    throw new Error("Apliiq client only permits the verified Apliiq API base URL.");
  }

  async function requestWithMetadata<T>(
    endpoint: string,
    options: ApliiqRequestOptions = {}
  ): Promise<ApliiqResponse<T>> {
      const method = options.method ?? "GET";
      const rawBody = options.body === undefined ? "" : JSON.stringify(options.body);
      if (rawBody === undefined) {
        throw new Error("Apliiq request body must be JSON serializable.");
      }
      const now = clock();
      const timestamp = Math.floor(now.getTime() / 1000);
      const authorization = createApliiqAuthorization({
        apiKey,
        sharedSecret,
        timestamp,
        nonce: nonce(),
        rawBody,
      });
      const response = await fetchImpl(joinEndpoint(baseUrl, endpoint), {
        method,
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          ...(rawBody ? { "Content-Type": "application/json" } : {}),
        },
        ...(rawBody ? { body: rawBody } : {}),
      });
      if (!response.ok) {
        // Provider responses can contain customer data. Expose the status for
        // safe branching but never read or include the body in an application error.
        throw new ApliiqHttpError(response.status);
      }

      const responseText = await response.text();
      return { status: response.status, data: parseJsonResponse<T>(responseText, response.status) };
  }

  return {
    requestWithMetadata,
    async request<T>(endpoint: string, options?: ApliiqRequestOptions): Promise<T> {
      return (await requestWithMetadata<T>(endpoint, options)).data;
    },
  };
}
