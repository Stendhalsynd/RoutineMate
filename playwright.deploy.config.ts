import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "deploy-verification.spec.ts",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://routinemate-kohl.vercel.app",
    headless: true,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  }
});
