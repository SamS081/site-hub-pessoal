import "server-only";

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { db, type UserRow } from "@/lib/db";

/*
 * Accounts, passwords and sessions. Passwords are hashed with scrypt and a
 * per-user salt. A session is a random token in an httpOnly cookie; the
 * database keeps only its SHA-256, so a copy of the database cannot sign
 * anyone in. Every check runs on the server.
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

export async function findUserByEmail(email: string) {
  const { rows } = await (await db()).execute({
    sql: "SELECT * FROM users WHERE email = ?",
    args: [normalizeEmail(email)],
  });
  return rows[0] as unknown as UserRow | undefined;
}

export async function createUser(name: string, email: string, password: string): Promise<User | null> {
  const id = randomUUID();
  const user = { id, name: name.trim(), email: normalizeEmail(email) };
  try {
    await (await db()).execute({
      sql: "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [id, user.name, user.email, await hashPassword(password), Date.now()],
    });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return null;
    throw error;
  }
  return user;
}

/** The user if the e-mail and password match, otherwise null. */
export async function checkCredentials(email: string, password: string): Promise<User | null> {
  const row = await findUserByEmail(email);
  const ok = await verifyPassword(password, row?.password_hash ?? (await DUMMY_HASH));
  return row && ok ? { id: row.id, name: row.name, email: row.email } : null;
}

/* ---------- sign-in brake ---------- */

/*
 * After MAX_TRIES wrong passwords for one e-mail, that e-mail waits LOCK_MS.
 * Kept in the database, so it holds across server restarts and instances.
 */
const MAX_TRIES = 5;
const LOCK_MS = 60_000;

export async function isSignInLocked(email: string) {
  const { rows } = await (await db()).execute({
    sql: "SELECT locked_until FROM login_attempts WHERE email = ?",
    args: [normalizeEmail(email)],
  });
  return Number(rows[0]?.locked_until ?? 0) > Date.now();
}

export async function recordFailedSignIn(email: string) {
  await (await db()).execute({
    sql: `INSERT INTO login_attempts (email, count, locked_until) VALUES (?1, 1, 0)
          ON CONFLICT(email) DO UPDATE SET
            count        = CASE WHEN count + 1 >= ?2 THEN 0 ELSE count + 1 END,
            locked_until = CASE WHEN count + 1 >= ?2 THEN ?3 ELSE locked_until END`,
    args: [normalizeEmail(email), MAX_TRIES, Date.now() + LOCK_MS],
  });
}

export async function clearFailedSignIns(email: string) {
  await (await db()).execute({ sql: "DELETE FROM login_attempts WHERE email = ?", args: [normalizeEmail(email)] });
}

/* ---------- sessions ---------- */

export async function startSession(userId: string) {
  const token = newToken();
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await (await db()).batch(
    [
      { sql: "DELETE FROM sessions WHERE expires_at < ?", args: [Date.now()] },
      { sql: "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", args: [sha256(token), userId, expires] },
    ],
    "write",
  );

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
  if (token) await (await db()).execute({ sql: "DELETE FROM sessions WHERE token_hash = ?", args: [sha256(token)] });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user for this request, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Expiry is checked against the clock, which is request time only.
  await connection();
  const { rows } = await (await db()).execute({
    sql: `SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ? AND s.expires_at > ?`,
    args: [sha256(token), Date.now()],
  });
  const row = rows[0] as unknown as User | undefined;
  return row ? { id: row.id, name: row.name, email: row.email } : null;
}

/* ---------- password reset ---------- */

/** A one-time token for a new password, or null if no account has this e-mail. */
export async function createResetToken(email: string) {
  const row = await findUserByEmail(email);
  if (!row) return null;
  const token = newToken();
  await (await db()).batch(
    [
      { sql: "DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?", args: [row.id, Date.now()] },
      {
        sql: "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        args: [sha256(token), row.id, Date.now() + RESET_MINUTES * 60 * 1000],
      },
    ],
    "write",
  );
  return token;
}

/** Sets the new password and signs the person out everywhere. Returns the user id, or null if the link is invalid or used. */
export async function resetPassword(token: string, password: string) {
  const conn = await db();
  // Taking the token and checking it is one statement, so a link works once.
  const { rows } = await conn.execute({
    sql: "DELETE FROM password_resets WHERE token_hash = ? AND expires_at > ? RETURNING user_id",
    args: [sha256(token), Date.now()],
  });
  const userId = rows[0]?.user_id as string | undefined;
  if (!userId) return null;

  await conn.batch(
    [
      { sql: "UPDATE users SET password_hash = ? WHERE id = ?", args: [await hashPassword(password), userId] },
      { sql: "DELETE FROM password_resets WHERE user_id = ?", args: [userId] },
      { sql: "DELETE FROM sessions WHERE user_id = ?", args: [userId] },
    ],
    "write",
  );
  return userId;
}
