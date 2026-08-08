import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Spins up a real (non-Docker) local Postgres for integration tests, so the
 * test suite is self-contained and runs the same way in any environment
 * (developer machine, CI) without requiring Docker to be installed. The
 * app's normal local-dev flow still uses docker-compose (see README) — this
 * is specifically for making `npm test` reproducible everywhere.
 */
export function createEmbeddedPostgres(opts: { port: number; dataDir: string }) {
  return new EmbeddedPostgres({
    databaseDir: path.resolve(__dirname, "../../.pgdata", opts.dataDir),
    user: "postgres",
    password: "postgres",
    port: opts.port,
    persistent: false,
  });
}
