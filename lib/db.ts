import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedIfEmpty } from "./seed";

const globalForDb = globalThis as unknown as {
  __stockroomDb?: Database.Database;
};

/** Where the SQLite file lives. DATA_DIR can point at a mounted persistent disk. */
export function dataDir(): string {
  const fromEnv = process.env.DATA_DIR;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  return path.join(process.cwd(), "data");
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE,
  contact_name   TEXT,
  email          TEXT,
  phone          TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sku              TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  description      TEXT,
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id      INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  cost_cents       INTEGER NOT NULL DEFAULT 0,
  quantity         INTEGER NOT NULL DEFAULT 0,
  reorder_level    INTEGER NOT NULL DEFAULT 0,
  location         TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjust')),
  quantity   INTEGER NOT NULL,
  delta      INTEGER NOT NULL,
  reason     TEXT,
  reference  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at DESC);
`;

function createDb(): Database.Database {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "inventory.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  seedIfEmpty(db);
  return db;
}

/** Process-wide singleton so Next.js hot reloads do not open a new handle each time. */
export function getDb(): Database.Database {
  if (!globalForDb.__stockroomDb) {
    globalForDb.__stockroomDb = createDb();
  }
  return globalForDb.__stockroomDb;
}

export function nowIso(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}
