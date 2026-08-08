/**
 * Manual dev helper: starts a local embedded Postgres (no Docker needed) on
 * port 5432, creates the app database, and keeps running until Ctrl+C.
 * Not part of the app's normal deployment/dev flow (docker-compose is — see
 * README) — this exists purely so the app is runnable in sandboxed
 * environments without Docker available.
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pg = new EmbeddedPostgres({
  databaseDir: path.resolve(__dirname, "../.pgdata/dev"),
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
});

async function main() {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("orders_and_settlements").catch(() => {});
  console.log("Embedded Postgres running on port 5432, database 'orders_and_settlements' ready.");
  console.log("Press Ctrl+C to stop.");
}

process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
