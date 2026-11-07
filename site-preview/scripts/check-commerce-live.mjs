// Independent, read-only check. No payment, quote, supplier submission or email.
import { SITE_ORIGIN, NETLIFY_SITE_ID } from "../server/platform/client.mjs";
const origin = SITE_ORIGIN;
const token = process.env.AHA_COMMERCE_MONITOR_TOKEN;
if (!token) throw new Error("The read-only commerce monitor token is missing.");
const problems = [];
for (const path of ["/release.json", "/checkout/", "/api/checkout/config", "/api/commerce/health"]) {
  try {
    const response = await fetch(origin + path, { redirect: "error", signal: AbortSignal.timeout(25_000),
      headers: { "cache-control": "no-cache", ...(path === "/api/commerce/health" ? { authorization: `Bearer ${token}` } : {}) } });
    if (path === "/api/commerce/health") {
      const status = await response.json();
      if (!response.ok || status.ok !== true) problems.push(...(Array.isArray(status.problems) ? status.problems.map((p) => `${String(p.code).replace(/[^a-z0-9_]/gi, "").slice(0, 80)}: ${Number(p.count) || 1}`) : [`commerce_health_http_${response.status}`]));
    } else if (!response.ok) problems.push(`${path}: HTTP ${response.status}`);
    else if (path === "/release.json") {
      const release = await response.json();
      if (release.siteId !== NETLIFY_SITE_ID || release.mode !== "production") problems.push("release_identity_mismatch");
      if (process.env.EXPECTED_COMMIT && release.sourceCommit !== process.env.EXPECTED_COMMIT) problems.push("release_commit_mismatch");
    }
  } catch { problems.push(`${path}: check_unavailable`); }
}
if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
else console.log("Commerce checks passed: storefront, payment configuration, order handoff, receipt delivery and worker freshness.");
