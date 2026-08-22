import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    environment: "node",
    // Sheets caches and locks are module-level singletons; isolate every file.
    isolate: true,
    pool: "forks",
    env: { LOG_LEVEL: "error", NODE_ENV: "test" }
  }
});
