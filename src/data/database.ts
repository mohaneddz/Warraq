import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

const DB_URL = "sqlite:warraq.db";

let connection: Database | null = null;

export async function database() {
  if (!connection) connection = await Database.load(DB_URL);
  return connection;
}

export type TxStatement = { sql: string; values?: unknown[] };

/**
 * Runs a batch of parameterized statements inside one SQLite transaction,
 * rolling back entirely if any statement fails. tauri-plugin-sql's execute()/select()
 * each borrow a pooled connection independently, so plain sequential "BEGIN"/"COMMIT"
 * calls cannot be relied on to share a connection — this goes through a dedicated
 * Rust command that owns the transaction for its full lifetime instead.
 */
export async function runTransaction(statements: TxStatement[]): Promise<void> {
  if (statements.length === 0) return;
  await database();
  await invoke("run_transaction", {
    db: DB_URL,
    statements: statements.map((s) => ({ sql: s.sql, values: s.values ?? [] })),
  });
}

/** Adds a column via a bare ALTER TABLE, tolerating only the "already exists" case. */
async function addColumnIfMissing(db: Database, table: string, definition: string) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  } catch (error) {
    const message = String(error);
    if (!/duplicate column name/i.test(message)) throw error;
  }
}

/**
 * Promotes queued reservations to "ready" for books that currently have available
 * copies, up to the number of available copies (oldest queue position first) —
 * covers the case where a copy becomes available outside of returnCopies()
 * (e.g. a fresh copy is added while reservations are pending).
 */
async function syncReservationQueue(db: Database) {
  const now = new Date().toISOString();
  let holdDays = 3;
  try {
    const stored = localStorage.getItem("warraq-preferences");
    if (stored) {
      const prefs = JSON.parse(stored) as { reservationHoldDays?: number };
      if (prefs.reservationHoldDays) holdDays = prefs.reservationHoldDays;
    }
  } catch {
    // Fall back to default hold period
  }
  const expiresAt = new Date(Date.now() + holdDays * 86_400_000).toISOString().split("T")[0];

  const availableCopies = await db.select<{ id: string; book_id: string }[]>(
    "SELECT id, book_id FROM copies WHERE status = 'available' ORDER BY book_id"
  );
  const copiesByBook = new Map<string, string[]>();
  for (const copy of availableCopies) {
    const list = copiesByBook.get(copy.book_id) ?? [];
    list.push(copy.id);
    copiesByBook.set(copy.book_id, list);
  }
  if (copiesByBook.size === 0) return;

  const statements: TxStatement[] = [];
  for (const [bookId, copyIds] of copiesByBook) {
    const queued = await db.select<{ id: string }[]>(
      "SELECT id FROM reservations WHERE book_id = ? AND status = 'queued' ORDER BY position ASC, reserved_at ASC LIMIT ?",
      [bookId, copyIds.length]
    );
    queued.forEach((reservation, index) => {
      const copyId = copyIds[index];
      statements.push({ sql: "UPDATE reservations SET status='ready', copy_id=?, expires_at=? WHERE id=?", values: [copyId, expiresAt, reservation.id] });
      statements.push({ sql: "UPDATE copies SET status='reserved', updated_at=? WHERE id=?", values: [now, copyId] });
    });
  }
  if (statements.length > 0) await runTransaction(statements);
}

export async function initializeDatabase() {
  const db = await database();
  await db.execute("PRAGMA foreign_keys = ON");
  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA busy_timeout = 5000");
  await db.execute("PRAGMA synchronous = NORMAL");

  await addColumnIfMissing(db, "books", "item_type TEXT NOT NULL DEFAULT 'book'");
  await addColumnIfMissing(db, "books", "metadata TEXT");
  await addColumnIfMissing(db, "reservations", "copy_id TEXT");

  await syncReservationQueue(db);
}
