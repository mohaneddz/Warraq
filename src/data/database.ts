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

  try {
    await db.execute("ALTER TABLE books ADD COLUMN item_type TEXT NOT NULL DEFAULT 'book'");
  } catch (_) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE books ADD COLUMN metadata TEXT");
  } catch (_) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE reservations ADD COLUMN copy_id TEXT");
  } catch (_) {
    // Column already exists
  }

  // Automatically promote queued reservations to ready if an available copy exists
  try {
    await db.execute(`
      UPDATE reservations 
      SET status = 'ready' 
      WHERE status = 'queued' 
        AND book_id IN (SELECT DISTINCT book_id FROM copies WHERE status = 'available')
    `);
  } catch (_) {
    // Ignore migration sync errors
  }
}
