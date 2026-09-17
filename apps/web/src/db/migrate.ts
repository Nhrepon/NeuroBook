/**
 * Migration runner (§15.5 O4).
 *
 * Every migration ships an `up` and a `down`, and a schema change requires a
 * migration — never a manual ALTER. Run with `npm run db:migrate`, or
 * `npm run db:rollback -- <sequence>` to reverse down to that sequence.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { rlsSql } from "./rls.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

interface MigrationFile {
  name: string;
  /** Ordered so `0001` runs before `0002`. */
  sequence: number;
}

async function listMigrations(): Promise<MigrationFile[]> {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && /^\d{4}-/.test(e.name))
    .map((e) => {
      const sequence = Number.parseInt(e.name.slice(0, 4), 10);
      return { name: e.name, sequence };
    })
    .sort((a, b) => a.sequence - b.sequence);
}

async function ensureSchemaMigrations(client: pg.Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      sequence INTEGER PRIMARY KEY,
      name     TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function appliedMigrations(client: pg.Client): Promise<Set<number>> {
  const result = await client.query("SELECT sequence FROM schema_migrations");
  return new Set(result.rows.map((r) => r.sequence));
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply pending migrations.
 *
 * Each migration directory holds `up.sql` and (required by O4) `down.sql`. The
 * RLS policies are applied once after the schema exists, and are idempotent.
 */
export async function migrate(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    await ensureSchemaMigrations(client);
    const applied = await appliedMigrations(client);
    const migrations = await listMigrations();

    let count = 0;
    for (const migration of migrations) {
      if (applied.has(migration.sequence)) continue;

      const dir = path.join(MIGRATIONS_DIR, migration.name);
      const up = path.join(dir, "up.sql");
      const down = path.join(dir, "down.sql");

      if (!(await fileExists(up))) throw new Error(`migration ${migration.name} has no up.sql`);
      if (!(await fileExists(down))) {
        throw new Error(
          `migration ${migration.name} has no down.sql — reversible migrations are required (O4)`,
        );
      }

      const sql = await fs.readFile(up, "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (sequence, name) VALUES ($1, $2)",
          [migration.sequence, migration.name],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`migration ${migration.name} failed: ${String(error)}`);
      }
      count += 1;
      console.log(`applied ${migration.name}`);
    }

    // RLS policies are idempotent; apply after every run so a fresh database
    // and an existing one both end up isolated.
    await client.query(rlsSql());
    console.log(`rls policies applied (${count} migration(s) run)`);
  } finally {
    await client.end();
  }
}

/**
 * Roll back migrations down to (but not including) the given sequence.
 *
 * Reversibility is tested, not assumed: O2's discipline applied to schema.
 */
export async function rollbackTo(sequence: number): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    const result = await client.query(
      "SELECT sequence, name FROM schema_migrations WHERE sequence > $1 ORDER BY sequence DESC",
      [sequence],
    );

    for (const row of result.rows) {
      const dir = path.join(MIGRATIONS_DIR, row.name);
      const down = path.join(dir, "down.sql");
      const sql = await fs.readFile(down, "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("DELETE FROM schema_migrations WHERE sequence = $1", [row.sequence]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`rollback of ${row.name} failed: ${String(error)}`);
      }
      console.log(`rolled back ${row.name}`);
    }
  } finally {
    await client.end();
  }
}

// CLI entry. Detection compares the file path, not process.argv[1], because
// npm/npx wraps the entry path and would otherwise prevent the CLI from
// running at all.
const isMain = process.argv[1]?.endsWith("migrate.ts") ?? false;
if (isMain) {
  const target = process.argv[2];
  migrate()
    .then(() => {
      if (target) return rollbackTo(Number.parseInt(target, 10));
      return undefined;
    })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
