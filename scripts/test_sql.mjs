/**
 * Applies every migration to a throwaway local Postgres cluster and runs the SQL tests in
 * supabase/tests against it. Never touches the Supabase project.
 *
 * Needs initdb, pg_ctl and psql on PATH. The cluster lives in the OS temp directory and is
 * removed afterwards, pass or fail.
 *
 * Usage:
 *   node scripts/test_sql.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MIGRATIONS = "supabase/migrations";
const TESTS = "supabase/tests";
const STUBS = join(TESTS, "supabase_stubs.sql");
const PORT = String(55000 + Math.floor(Math.random() * 1000));

const dataDir = mkdtempSync(join(tmpdir(), "warraq_sql_"));

function run(cmd, args, { quiet = false } = {}) {
  return execFileSync(cmd, args, { stdio: quiet ? ["ignore", "ignore", "inherit"] : "inherit" });
}

function psql(file, { stopOnError = true, db = "warraq" } = {}) {
  run("psql", ["-p", PORT, "-U", "postgres", "-d", db, "-q", "-X",
    "-v", `ON_ERROR_STOP=${stopOnError ? 1 : 0}`, "-f", file]);
}

let started = false;
let failed = false;
try {
  run("initdb", ["-D", dataDir, "-U", "postgres", "-A", "trust"], { quiet: true });
  run("pg_ctl", ["-D", dataDir, "-o", `-p ${PORT}`, "-l", join(dataDir, "server.log"), "-w", "start"], { quiet: true });
  started = true;
  run("psql", ["-p", PORT, "-U", "postgres", "-q", "-c", "create database warraq"]);

  psql(STUBS);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    psql(join(MIGRATIONS, file));
  }

  const tests = readdirSync(TESTS).filter((f) => f.endsWith(".sql") && join(TESTS, f) !== STUBS).sort();
  for (const file of tests) {
    console.log(`\n${file}`);
    psql(join(TESTS, file));
  }
  console.log(`\n${tests.length} SQL test file(s) passed`);
  // The script new installs paste into their own Supabase project has to build the same schema on
  // an empty database in one go. The stubs' roles already exist cluster wide, so errors from
  // re-running them are expected and ignored; the schema script itself must apply with none.
  run("psql", ["-p", PORT, "-U", "postgres", "-q", "-c", "create database warraq_bundle"]);
  psql(STUBS, { stopOnError: false, db: "warraq_bundle" });
  psql("src/assets/schema.sql", { db: "warraq_bundle" });
  console.log("bundled schema.sql applied cleanly to an empty database");
} catch {
  failed = true;
} finally {
  if (started) run("pg_ctl", ["-D", dataDir, "-m", "fast", "stop"], { quiet: true });
  rmSync(dataDir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
