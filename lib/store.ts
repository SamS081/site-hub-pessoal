import "server-only";

import { db } from "@/lib/db";

/*
 * Each account's tasks, notes and habits, kept on the server as one JSON
 * document (the same shape lib/orbita.ts keeps in the browser). Every write
 * bumps a revision number; a write must name the revision it was based on,
 * so two devices saving at once cannot silently overwrite each other: the
 * late one gets the current document back, merges, and tries again.
 */

export type Stored = { data: unknown; rev: number };

/** The biggest document accepted, as JSON text. */
export const MAX_BYTES = 2 * 1024 * 1024;

export async function readUserData(userId: string): Promise<Stored | null> {
  const { rows } = await (await db()).execute({
    sql: "SELECT data, rev FROM user_data WHERE user_id = ?",
    args: [userId],
  });
  const row = rows[0];
  if (!row) return null;
  return { data: JSON.parse(row.data as string), rev: Number(row.rev) };
}

/**
 * Saves the document if the stored revision is still `baseRev` (0 when the
 * account has none yet). Returns the new revision, or null on a conflict.
 */
export async function writeUserData(userId: string, json: string, baseRev: number): Promise<number | null> {
  const conn = await db();
  const now = Date.now();
  // Compare-and-set in one statement, so concurrent writes cannot both win.
  const { rowsAffected } =
    baseRev === 0
      ? await conn.execute({
          sql: "INSERT INTO user_data (user_id, data, rev, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING",
          args: [userId, json, now],
        })
      : await conn.execute({
          sql: "UPDATE user_data SET data = ?, rev = rev + 1, updated_at = ? WHERE user_id = ? AND rev = ?",
          args: [json, now, userId, baseRev],
        });
  return rowsAffected === 1 ? baseRev + 1 : null;
}

/** A loose check that a document has the shape lib/orbita.ts expects. */
export function isOrbitaData(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const list = (x: unknown) =>
    Array.isArray(x) && x.every((item) => item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string");
  return list(v.tasks) && list(v.notes) && list(v.habits) && typeof v.sample === "boolean";
}
