export type BoundedRequestBodyResult =
  | { ok: true; rawBody: string }
  | { ok: false; reason: "invalid-content-length" | "body-too-large" };

export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedRequestBodyResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return { ok: false, reason: "invalid-content-length" };
    }

    const declaredBytes = Number(contentLength);
    if (declaredBytes > maxBytes) {
      return { ok: false, reason: "body-too-large" };
    }
  }

  if (!request.body) {
    return { ok: true, rawBody: "" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("Webhook payload is too large").catch(() => {});
        return { ok: false, reason: "body-too-large" };
      }
      chunks.push(value.slice());
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, rawBody: new TextDecoder().decode(bytes) };
}
