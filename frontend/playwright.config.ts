import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a locally running frontend + backend (see README "Running
 * the e2e suite"). The backend needs a real Postgres behind it (docker-compose
 * or the embedded-postgres dev script), so it is not auto-started here —
 * only the frontend dev server is, and only if one isn't already running.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
