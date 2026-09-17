import { defineConfig } from "drizzle-kit";

// Drizzle Kit config. DATABASE_URL is validated at boot by next.config.ts (O5),
// so a missing key fails loudly here rather than mid-migration.
const url = process.env.DATABASE_URL ?? "postgresql://neurobook@127.0.0.1:5432/neurobook";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  // Money is integer minor units (R7): never let an accidental numeric column
  // sneak in. bigint/integer only.
  strict: true,
  verbose: true,
});

