import Database from "@tauri-apps/plugin-sql";

let connection: Database | null = null;

export async function database() {
  if (!connection) connection = await Database.load("sqlite:warraq.db");
  return connection;
}

export async function initializeDatabase() {
  const db = await database();
  await db.execute("PRAGMA foreign_keys = ON");
  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA busy_timeout = 5000");
  await db.execute("PRAGMA synchronous = NORMAL");
}
