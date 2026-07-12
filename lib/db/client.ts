// Drizzle over Netlify DB (Neon serverless HTTP). Netlify's managed runtime binding is
// NETLIFY_DB_URL; legacy/local environments may provide NETLIFY_DATABASE_URL or DATABASE_URL.
// Safe when unset (build/preview without DB) — guard callers with isDbConfigured().
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { getConnectionString } from "@netlify/database";
import * as schema from "@/db/schema";

function connectionUrl(): string {
  const explicit = (
    process.env.NETLIFY_DB_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ""
  ).trim();
  if (explicit) return explicit;
  try {
    return getConnectionString().trim();
  } catch {
    return "";
  }
}

export function isDbConfigured(): boolean {
  return Boolean(connectionUrl());
}

let _db: NeonHttpDatabase<typeof schema> | null = null;

/** Drizzle db instance. Throws if the DB is not configured. */
export function db(): NeonHttpDatabase<typeof schema> {
  if (!isDbConfigured()) {
    throw new Error("No Netlify Database connection is available. See db/README.md");
  }
  if (!_db) _db = drizzle(connectionUrl(), { schema });
  return _db;
}

export { schema };
