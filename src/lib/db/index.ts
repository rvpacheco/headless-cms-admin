import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

// A single local SQLite file. Created on first run; no external setup needed.
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'cms.db');

// In `next dev`, hot reload re-executes modules, which would otherwise reopen
// the database file on every change. Cache the connection on `globalThis` so a
// single connection survives reloads.
const globalForDb = globalThis as unknown as { db?: Database.Database };

function createConnection(): Database.Database {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  // Wait (up to 5s) rather than failing immediately when another connection
  // holds a lock — e.g. parallel `next build` workers all opening the file at
  // once. WAL improves concurrent read/write; foreign keys are off by default
  // in SQLite and must be enabled per-connection.
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  return db;
}

/** Create the tables on boot if they don't exist yet. */
function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schemas (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      version    INTEGER NOT NULL DEFAULT 1,
      fields     TEXT NOT NULL,          -- JSON: Field[]
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id             TEXT PRIMARY KEY,
      schema_id      TEXT NOT NULL REFERENCES schemas(id),
      schema_version INTEGER NOT NULL,   -- version this entry was written against
      data           TEXT NOT NULL,      -- JSON: EntryData
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entries_schema_id ON entries (schema_id);
  `);
}

export const db: Database.Database =
  globalForDb.db ?? (globalForDb.db = createConnection());

/**
 * Run `fn` inside a single transaction: all statements commit together, or roll
 * back together if `fn` throws. better-sqlite3 runs synchronously, so `fn` must
 * be synchronous too.
 */
export function transaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}
