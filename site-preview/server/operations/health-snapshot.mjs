import { getStore } from "@netlify/blobs";

const key = "latest";
const maxAge = 20 * 60_000; // Quarter-hour check plus five minutes of scheduling tolerance.
export const snapshotStore = () => getStore({ name: "commerce-health-v1", consistency: "strong" });
export const unhealthy = (code) => ({ ok: false, problems: [{ code, count: 1 }] });

export async function publishSnapshot(store, report) {
  const { ok, checkedAt, checks, problems } = report;
  // A delayed run must never overwrite a newer observation.
  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await store.getWithMetadata(key, { type: "json" });
    if (latest?.data?.checkedAt > checkedAt) return;
    const condition = latest ? { onlyIfMatch: latest.etag } : { onlyIfNew: true };
    const write = await store.setJSON(key, { ok, checkedAt, checks, problems }, condition);
    if (write.modified) return;
  }
  throw new Error("commerce_snapshot_write_conflict");
}

export async function readSnapshot(store, now) {
  const report = await store.get(key, { type: "json" });
  const age = (now ?? Date.now()) - Date.parse(report?.checkedAt);
  if (!report || !Number.isFinite(age) || age < 0 || typeof report.ok !== "boolean" ||
      !Array.isArray(report.problems) || report.ok !== (report.problems.length === 0) ||
      !report.problems.every(p => typeof p?.code === "string" && Number.isInteger(p.count) && p.count > 0))
    return unhealthy("commerce_check_unavailable");
  if (age > maxAge) return unhealthy("commerce_monitor_stale");
  return report;
}
