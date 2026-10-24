import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/*
 * Atol's accounts live in one SQLite file (Node's built-in node:sqlite, no
 * server to run). The path can be moved with ATOL_DB_PATH; by default it is
 * data/atol.db next to the app, which git ignores.
 *
 *   users            one row per account; the password is a scrypt hash
 *   sessions         signed-in browsers; only a SHA-256 of the cookie token
 *   password_resets  one-time links to set a new password; also hashed
 */

const DB_PATH = process.env.ATOL_DB_PATH ?? path.join(process.cwd(), "data", "atol.db");

// Kept on globalThis so dev hot reloads reuse the same connection.
const g = globalThis as unknown as { atolDb?: DatabaseSync };

function open() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
  `);
  return db;
}

export function db() {
  g.atolDb ??= open();
  return g.atolDb;
}

export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: number;
};
