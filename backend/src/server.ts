import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { env } from "./config/env.js";

async function main() {
  const app = await buildApp(db);
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`Server listening on port ${env.PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
