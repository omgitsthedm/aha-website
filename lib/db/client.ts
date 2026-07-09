// Drizzle over Netlify DB (Neon serverless HTTP). Connection is injected by Netlify as
// NETLIFY_DATABASE_URL at runtime; falls back to DATABASE_URL for local/CI. Safe when unset
// (build/preview without DB) — guard callers with isDbConfigured(). No card data / tokens in DB (§14).
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

function connectionUrl(): string {
  return (process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL || "").trim();
}

export function isDbConfigured(): boolean {
  return Boolean(connectionUrl());
}

let _db: NeonHttpDatabase<typeof schema> | null = null;

/** Drizzle db instance. Throws if the DB is not configured. */
export function db(): NeonHttpDatabase<typeof schema> {
  if (!isDbConfigured()) {
    throw new Error("No NETLIFY_DATABASE_URL / DATABASE_URL — provision Netlify DB (Neon). See db/README.md");
  }
  if (!_db) _db = drizzle(connectionUrl(), { schema });
  return _db;
}

export { schema };
