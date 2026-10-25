import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

/*
 * Atol's accounts live in one SQLite database, reached through libSQL. In
 * production that is a Turso database (TURSO_DATABASE_URL and
 * TURSO_AUTH_TOKEN); without them it is a local file, data/atol.db by
 * default (ATOL_DB_PATH moves it), which git ignores.
 *
 *   users            one row per account; the password is a scrypt hash
 *   sessions         signed-in browsers; only a SHA-256 of the cookie token
 *   password_resets  one-time links to set a new password; also hashed
 *   login_attempts   wrong passwords per e-mail, for the sign-in brake
 *   user_data        each account's tasks, notes and habits, as one JSON
 *                    document with a revision number (lib/store.ts)
 */

const SCHEMA = `
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

  CREATE TABLE IF NOT EXISTS login_attempts (
    email        TEXT PRIMARY KEY,
    count        INTEGER NOT NULL,
    locked_until INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_data (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data       TEXT NOT NULL,
    rev        INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

function databaseUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  const file = process.env.ATOL_DB_PATH ?? path.join(process.cwd(), "data", "atol.db");
  mkdirSync(path.dirname(file), { recursive: true });
  return `file:${file}`;
}

async function open() {
  const client = createClient({ url: databaseUrl(), authToken: process.env.TURSO_AUTH_TOKEN });
  await client.executeMultiple(SCHEMA);
  return client;
}

// Kept on globalThis so dev hot reloads reuse the same connection.
const g = globalThis as unknown as { atolDb?: Promise<Client> };

/** The database, with its tables created on first use. */
export function db() {
  g.atolDb ??= open().catch((error) => {
    g.atolDb = undefined;
    throw error;
  });
  return g.atolDb;
}

export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: number;
};
