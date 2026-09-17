import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The web app imports via the `@/` alias; Vitest resolves paths itself rather
 * than reading tsconfig paths, so the alias has to be declared here too.
 *
 * Tests run from the repo root and cover every app and package.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web/src"),
    },
  },
  test: {
    include: ["packages/*/tests/**/*.test.ts", "apps/*/tests/**/*.test.ts"],
  },
});
