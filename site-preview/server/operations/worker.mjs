import { heartbeat } from "./heartbeat.mjs";
export async function trackWorker(db, job, run, env = { get: () => null }) {
  await db.sql`UPDATE aha_commerce_workers SET last_started_at = now() WHERE job = ${job}`;
  try {
    const result = await run();
    await db.sql`UPDATE aha_commerce_workers SET last_succeeded_at = now() WHERE job = ${job}`;
    await heartbeat(env,job,true);
    return result;
  } catch (error) {
    await db.sql`UPDATE aha_commerce_workers SET last_failed_at = now() WHERE job = ${job}`;
    await heartbeat(env,job,false);
    throw error;
  }
}
