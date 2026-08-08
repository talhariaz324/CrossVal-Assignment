import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["test/integration/**/*.test.ts"],
    globalSetup: ["test/setup/globalSetup.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Integration tests share one Postgres instance and truncate between
    // tests (see resetDb) — run test files sequentially to avoid one file's
    // truncate racing another file's assertions.
    fileParallelism: false,
  },
});
