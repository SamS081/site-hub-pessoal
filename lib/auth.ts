import "server-only";

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { db, type UserRow } from "@/lib/db";

/*
 * Accounts, passwords and sessions. Passwords are hashed with scrypt and a
 * per-user salt. A session is a random token in an httpOnly cookie; the
 * database keeps only its SHA-256, so a copy of the file cannot sign anyone
 * in. Every check runs on the server.
 */

export type User = { id: string; name: string; email: string };

export const SESSION_COOKIE = "atol_session";
const SESSION_DAYS = 30;
const RESET_MINUTES = 30;

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scryptAsync(password.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

// Compared against when the e-mail is unknown, so both cases take as long.
const DUMMY_HASH = hashPassword(randomUUID());

const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function findUserByEmail(email: string) {
  return db().prepare("SELECT * FROM users WHERE email = ?").get(normalizeEmail(email)) as UserRow | undefined;
}

export async function createUser(name: string, email: string, password: string): Promise<User | null> {
  const id = randomUUID();
  const user = { id, name: name.trim(), email: normalizeEmail(email) };
  try {
    db()
      .prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, user.name, user.email, await hashPassword(password), Date.now());
  } catch (error) {
    if (String(error).includes("UNIQUE")) return null;
    throw error;
  }
  return user;
}

/** The user if the e-mail and password match, otherwise null. */
export async function checkCredentials(email: string, password: string): Promise<User | null> {
  const row = findUserByEmail(email);
  const ok = await verifyPassword(password, row?.password_hash ?? (await DUMMY_HASH));
  return row && ok ? { id: row.id, name: row.name, email: row.email } : null;
}

/* ---------- sessions ---------- */

export async function startSession(userId: string) {
  const token = newToken();
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const conn = db();
  conn.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  conn.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha256(token), userId, expires);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user for this request, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Expiry is checked against the clock, which is request time only.
  await connection();
  const row = db()
    .prepare(
      `SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), Date.now()) as User | undefined;
  return row ? { id: row.id, name: row.name, email: row.email } : null;
}

/* ---------- password reset ---------- */

/** A one-time token for a new password, or null if no account has this e-mail. */
export function createResetToken(email: string) {
  const row = findUserByEmail(email);
  if (!row) return null;
  const token = newToken();
  const conn = db();
  conn.prepare("DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?").run(row.id, Date.now());
  conn
    .prepare("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(sha256(token), row.id, Date.now() + RESET_MINUTES * 60 * 1000);
  return token;
}

/** Sets the new password and signs the person out everywhere. Returns the user id, or null if the link is invalid or used. */
export async function resetPassword(token: string, password: string) {
  const conn = db();
  const reset = conn
    .prepare("SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?")
    .get(sha256(token), Date.now()) as { user_id: string } | undefined;
  if (!reset) return null;

  conn.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashPassword(password), reset.user_id);
  conn.prepare("DELETE FROM password_resets WHERE user_id = ?").run(reset.user_id);
  conn.prepare("DELETE FROM sessions WHERE user_id = ?").run(reset.user_id);
  return reset.user_id;
}
