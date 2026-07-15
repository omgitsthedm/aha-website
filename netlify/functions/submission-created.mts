// Netlify Forms trigger: fires automatically when any form is submitted.
// For the "newsletter" form, hand the email to the gated welcome route.
// Harmless before launch — the route only sends when lifecycle email is enabled.
export default async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const payload = (body?.payload ?? {}) as Record<string, unknown>;
    const data = (payload?.data ?? {}) as Record<string, unknown>;
    const formName = payload?.form_name || payload?.formName;
    const email = (data?.email || payload?.email) as string | undefined;
    if (formName !== "newsletter" || !email) return new Response("skip", { status: 200 });

    const base = (process.env.SITE_URL || process.env.URL || "https://afterhoursagenda.com").replace(/\/$/, "");
    const secret = process.env.CRON_SECRET;
    if (!secret) return new Response("CRON_SECRET not set", { status: 200 });
    await fetch(`${base}/api/newsletter/welcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    return new Response("ok", { status: 200 });
  } catch (error) {
    return new Response(String(error).slice(0, 300), { status: 200 });
  }
};
