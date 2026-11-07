export async function trackWorker(db, job, run) {
  await db.sql`UPDATE aha_commerce_workers SET last_started_at = now() WHERE job = ${job}`;
  try {
    const result = await run();
    await db.sql`UPDATE aha_commerce_workers SET last_succeeded_at = now() WHERE job = ${job}`;
    return result;
  } catch (error) {
    await db.sql`UPDATE aha_commerce_workers SET last_failed_at = now() WHERE job = ${job}`;
    throw error;
  }
}
