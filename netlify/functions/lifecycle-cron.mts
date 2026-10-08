// This remains an authenticated manual operations hook. It is intentionally
// unscheduled and dormant until operations opens an explicit automation window.
import { automationsEnabled, isScheduledInvocation } from "../../lib/security/cron-guard";

export default async (req: Request) => {
  if (!automationsEnabled() || !(await isScheduledInvocation(req))) {
    return new Response(null, { status: 204 });
  }
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
