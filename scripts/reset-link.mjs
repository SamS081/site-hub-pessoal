/*
 * Gera um link de nova senha para uma conta, para quem cuida do Atol mandar
 * à pessoa por outro meio (WhatsApp, por exemplo) quando o e-mail não está
 * configurado. É o mesmo link que o "esqueci a senha" enviaria: vale uma vez
 * só, e a pessoa escolhe a senha nova sem que ninguém mais a veja. As
 * tarefas, notas e hábitos da conta não mudam.
 *
 *   node --env-file=.env.local scripts/reset-link.mjs pessoa@email.com
 *
 * Usa o mesmo banco do site: o Turso se TURSO_DATABASE_URL estiver definido,
 * senão o arquivo local (ATOL_DB_PATH ou data/atol.db). O endereço do link
 * vem de SITE_URL.
 */
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { createClient } from "@libsql/client";

const HOURS = 24;

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Uso: node --env-file=.env.local scripts/reset-link.mjs pessoa@email.com");
  process.exit(1);
}

const url =
  process.env.TURSO_DATABASE_URL ??
  `file:${process.env.ATOL_DB_PATH ?? path.join(process.cwd(), "data", "atol.db")}`;
const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const { rows } = await db.execute({ sql: "SELECT id, name FROM users WHERE email = ?", args: [email] });
const user = rows[0];
if (!user) {
  console.error(`Nenhuma conta com o e-mail ${email} em ${url.startsWith("file:") ? url : "o Turso"}.`);
  process.exit(1);
}

// Como em lib/auth.ts: o banco guarda só o SHA-256 do token.
const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token).digest("hex");
await db.batch(
  [
    { sql: "DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?", args: [user.id, Date.now()] },
    {
      sql: "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
      args: [hash, user.id, Date.now() + HOURS * 60 * 60 * 1000],
    },
  ],
  "write",
);

console.log(`Link de nova senha para ${user.name} <${email}>, vale por ${HOURS} h e uma vez só:\n`);
console.log(`${site}/login?redefinir=${token}\n`);
