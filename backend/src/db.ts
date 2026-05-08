import { Pool } from "pg";

let pool: Pool | null = null;

export function connectDB(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[DB] DATABASE_URL not set — history will be in-memory only");
    return;
  }
  pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30000,
    ssl: { rejectUnauthorized: false },
  });
  pool.on("error", (err) => console.error("[DB] Pool error:", err.message));
  console.log("[DB] PostgreSQL pool initialized (PgBouncer)");
}

export function getDb(): Pool | null {
  return pool;
}

export function isConnected(): boolean {
  return pool !== null;
}
