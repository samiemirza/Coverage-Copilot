import pg from "pg";
import type { Env } from "@coverage-copilot/shared";

/**
 * A single shared pool for the process. Every resolver that touches tenant
 * data must scope its query by business_id (Security §4.2) — this module
 * only owns the connection, not query construction.
 */
export function createPool(env: Env): pg.Pool {
  return new pg.Pool({ connectionString: env.DATABASE_URL });
}
