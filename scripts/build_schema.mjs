// Joins supabase/migrations/*.sql into the single script the app ships (src/assets/schema.sql).
// New installs paste that script into their own Supabase project's SQL editor. Run this after
// adding a migration; `pnpm test` fails when the shipped copy is out of date.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const output = join(root, "src", "assets", "schema.sql");

export function buildSchema() {
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
  const header = [
    "-- Warraq database schema",
    "-- Run this ONCE in a brand new, empty Supabase project: Dashboard > SQL Editor > New query,",
    "-- paste the whole script, press Run. It is the migrations in supabase/migrations joined in order.",
    "",
  ].join("\n");
  const body = files
    .map((name) => `-- ============================================================\n-- ${name}\n-- ============================================================\n${readFileSync(join(migrationsDir, name), "utf8").replace(/\r\n/g, "\n").trimEnd()}\n`)
    .join("\n");
  return { files, text: `${header}\n${body}` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { files, text } = buildSchema();
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, text);
  console.log(`Wrote ${output} from ${files.length} migrations (${text.length} bytes).`);
}
