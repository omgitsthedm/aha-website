import { getDatabase } from "@netlify/database";
const db = getDatabase();
const rows =
  await db.sql`SELECT day,path,event,device,bucket,count FROM aha_site_metrics WHERE day>=CURRENT_DATE-INTERVAL '30 days' ORDER BY day,path,event,device,bucket`;
const totals = {};
const histograms = {};
for (const row of rows) {
  const key = row.event + " / " + row.device;
  totals[key] = (totals[key] || 0) + Number(row.count);
  if (["LCP", "INP", "CLS"].includes(row.event)) {
    (histograms[key] ||= []).push(row);
  }
}
const p75 = {};
for (const [key, values] of Object.entries(histograms)) {
  values.sort((a, b) => a.bucket - b.bucket);
  const target = Math.ceil(totals[key] * 0.75);
  let n = 0;
  for (const row of values) {
    n += Number(row.count);
    if (n >= target) {
      p75[key] = {
        upperBucketEstimate:
          row.bucket *
          (row.event === "CLS" ? 0.01 : row.event === "INP" ? 25 : 250),
        samples: totals[key],
      };
      break;
    }
  }
}
console.log(
  JSON.stringify(
    {
      window: "last 30 days",
      counts: totals,
      p75,
      notes:
        "Consenting visits only. Counts are not unique people. P75 values are histogram upper-bound estimates, not a CrUX report.",
    },
    null,
    2,
  ),
);

await db.pool.end();
