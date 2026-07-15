// Netlify Scheduled Function — hourly lifecycle dispatch (abandoned-cart, etc.).
// It just pings the secret-gated Next route that does the work. Harmless before
// launch: that route dry-runs (sends nothing) unless LIFECYCLE_EMAIL_ENABLED=true.
export const config = { schedule: "@hourly" };

export default async () => {
  const base = (process.env.SITE_URL || process.env.URL || "https://afterhoursagenda.com").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET not set — skipping", { status: 200 });
  try {
    const res = await fetch(`${base}/api/cron/lifecycle`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    return new Response(`lifecycle dispatch: ${res.status} ${body}`.slice(0, 500), { status: 200 });
  } catch (error) {
    return new Response(`lifecycle dispatch error: ${String(error)}`.slice(0, 500), { status: 200 });
  }
};
