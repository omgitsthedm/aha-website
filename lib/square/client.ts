const SQUARE_BASE_URL = "https://connect.squareup.com/v2";

interface SquareRequestOptions {
  method?: string;
  body?: Record<string, unknown>;
}

export async function squareRequest<T>(
  endpoint: string,
  options: SquareRequestOptions = {}
): Promise<T> {
  const { method = "GET", body } = options;

  const res = await fetch(`${SQUARE_BASE_URL}${endpoint}`, {
    method,
    headers: {
      "Square-Version": process.env.SQUARE_API_VERSION || "2024-01-18",
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    next: { revalidate: 300 }, // 5 min ISR
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      `Square API error ${res.status}: ${JSON.stringify(error)}`
    );
  }

  return res.json();
}
