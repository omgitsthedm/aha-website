import { createHash } from 'node:crypto';
export async function permitPaymentAttempt(db, clientKey, now=Date.now()) {
  const key=createHash('sha256').update(`payment:${clientKey}`).digest('hex');
  const window=new Date(Math.floor(now/900_000)*900_000).toISOString();
  const [row]=await db.sql`INSERT INTO aha_commerce_rate_limits(key_hash,window_start) VALUES(${key},${window})
    ON CONFLICT(key_hash,window_start) DO UPDATE SET attempts=aha_commerce_rate_limits.attempts+1 RETURNING attempts`;
  return Number(row?.attempts)<=20;
}
