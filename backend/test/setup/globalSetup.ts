import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { createEmbeddedPostgres } from "./embeddedPg.js";

const TEST_PORT = 5433;
const TEST_DB_URL = `postgres://postgres:postgres@localhost:${TEST_PORT}/orders_and_settlements_test`;

/**
 * Vitest global setup: runs once before the whole integration test run, in
 * the parent process. Starts a real (non-Docker) local Postgres so the test
 * suite is self-contained and reproducible in any environment — the app's
 * normal dev flow still uses docker-compose's `postgres_test` service on
 * this same port 5433, so DATABASE_URL is identical either way.
 */
export async function setup() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.JWT_SECRET = "test-secret-not-for-production-use-only-32ch";
  process.env.CORS_ORIGIN = "http://localhost:5173";

  const pgInstance = createEmbeddedPostgres({ port: TEST_PORT, dataDir: "test" });
  await pgInstance.initialise();
  await pgInstance.start();
  await pgInstance.createDatabase("orders_and_settlements_test").catch(() => {});

  const pool = new pg.Pool({ connectionString: TEST_DB_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  await pool.end();

  return async () => {
    await pgInstance.stop();
  };
}
