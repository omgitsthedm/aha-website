// Thin Postgres access over Netlify DB (Neon serverless HTTP driver).
// Safe when DATABASE_URL is unset (build/preview without DB) — callers should guard with isDbConfigured().
// Never store card data or API tokens in the DB. See §14.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false> | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Returns the tagged-template SQL function, or throws if the DB is not configured. */
export function db(): NeonQueryFunction<false, false> {
  if (!isDbConfigured()) {
    throw new Error("DATABASE_URL is not set — provision Netlify DB (Neon) first. See db/README.md");
  }
  if (!sql) sql = neon(process.env.DATABASE_URL as string);
  return sql;
}
