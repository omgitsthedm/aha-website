interface ResendResponse { id?: string; message?: string; name?: string }

export function isTransactionalEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.RESEND_REPLY_TO);
}

export async function sendTransactionalEmail(input: {
  idempotencyKey: string; to: string; subject: string; html: string; text: string; bcc?: string;
}): Promise<string> {
  if (!isTransactionalEmailConfigured()) throw new Error("Transactional email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [input.to],
      reply_to: process.env.RESEND_REPLY_TO,
      ...(input.bcc ? { bcc: [input.bcc] } : {}),
      subject: input.subject, html: input.html, text: input.text,
      tags: [{ name: "stream", value: "transactional" }],
    }),
  });
  const result = await response.json().catch(() => ({})) as ResendResponse;
  if (!response.ok || !result.id) throw new Error(`Resend ${response.status}: ${result.message || result.name || "send failed"}`);
  return result.id;
}
