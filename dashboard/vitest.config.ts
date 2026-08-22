import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["dashboard/server/__tests__/**/*.test.ts", "server/__tests__/**/*.test.ts"],
    environment: "node",
    isolate: true,
    pool: "forks",
    env: { LOG_LEVEL: "error", NODE_ENV: "test", GOOGLE_SHEETS_SPREADSHEET_ID: "test-sheet-id" }
  }
});
