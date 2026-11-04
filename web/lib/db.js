import { Pool } from "pg";

function criarPool() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  url.searchParams.delete("sslmode");

  const ca = process.env.PG_CA_CERT?.replace(/\\n/g, "\n");
  return new Pool({
    connectionString: url.toString(),
    ssl: local ? undefined : ca ? { ca } : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
  });
}

export const pool = globalThis._pool ?? (globalThis._pool = criarPool());

export async function consulta(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}
