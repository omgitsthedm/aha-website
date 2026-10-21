/** Bound streamed requests before retaining/parsing their entire bodies. */
export async function boundedText(request, maxBytes, timeoutMs = 5000) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(length) || length < 0 || length > maxBytes) throw new Error('request_size');
  const reader = request.body?.getReader();
  if (!reader) return '';
  let bytes = 0;
  let expired = false;
  const chunks = [];
  const timer = setTimeout(() => { expired = true; void reader.cancel().catch(() => {}); }, timeoutMs);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (expired) throw new Error('request_timeout');
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('request_size'); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
