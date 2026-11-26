import { Pool, type ClientConfig, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

/**
 * Postgres access through `pg`. The same code runs against Neon and a local Docker Postgres:
 * only DATABASE_URL changes. TLS is enabled only when the URL asks for it (`sslmode=require`).
 */

/** Builds a pg config from a connection URL. Never logs the URL. */
export function pgConfigFromUrl(rawUrl: string): ClientConfig {
  const url = new URL(rawUrl);
  const mode = url.searchParams.get("sslmode");
  const wantsSsl = mode === "require" || mode === "verify-full" || mode === "verify-ca";
  // These are consumed here so pg's own URL parsing does not override our ssl setting.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  return {
    connectionString: url.toString(),
    ssl: wantsSsl ? { rejectUnauthorized: true } : false,
  };
}

interface DbGlobals {
  __cpkPool?: Pool;
}
const store = globalThis as typeof globalThis & DbGlobals;

/** Singleton on globalThis so dev hot reloads do not leak connections. */
export function getPool(): Pool {
  if (store.__cpkPool) return store.__cpkPool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured. Add it to .env.local (see .env.local.example).");
  }
  const pool = new Pool({
    ...pgConfigFromUrl(databaseUrl),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // An idle client erroring (e.g. server restart) must not crash the process.
  pool.on("error", () => {
    /* the pool discards the broken client and reconnects on next use */
  });
  store.__cpkPool = pool;
  return pool;
}

/** Parameterized query helper. `text` must be a constant; values always go in `params`. */
export function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
