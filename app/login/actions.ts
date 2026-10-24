"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  checkCredentials,
  createResetToken,
  createUser,
  endSession,
  normalizeEmail,
  resetPassword,
  startSession,
} from "@/lib/auth";

/*
 * The login page's server side. Every action validates again here: the
 * client's checks are only for quick feedback.
 */

export type FieldErrors = { name?: string; email?: string; password?: string; form?: string };
export type AuthResult = { ok: true; devLink?: string } | { ok: false; errors: FieldErrors };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

const fail = (errors: FieldErrors): AuthResult => ({ ok: false, errors });

function checkEmail(email: unknown) {
  return typeof email === "string" && EMAIL.test(email.trim()) && email.length <= 254;
}

function checkPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= MIN_PASSWORD && password.length <= 200;
}

/*
 * A small brake on password guessing: after 5 wrong tries for one e-mail,
 * that e-mail waits a minute. In memory, so it resets with the server.
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_TRIES = 5;
const LOCK_MS = 60_000;

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!checkEmail(email)) return fail({ email: "Confira o e-mail: falta o @ ou o domínio." });
  if (typeof password !== "string" || !password) return fail({ password: "Digite sua senha." });

  const key = normalizeEmail(email);
  const entry = attempts.get(key);
  if (entry && entry.until > Date.now()) {
    return fail({ form: "Muitas tentativas. Espere um minuto e tente de novo." });
  }

  const user = await checkCredentials(email, password);
  if (!user) {
    const count = (entry?.count ?? 0) + 1;
    attempts.set(key, { count: count >= MAX_TRIES ? 0 : count, until: count >= MAX_TRIES ? Date.now() + LOCK_MS : 0 });
    return fail({ form: "E-mail ou senha não conferem." });
  }

  attempts.delete(key);
  await startSession(user.id);
  return { ok: true };
}

export async function signUp(name: string, email: string, password: string): Promise<AuthResult> {
  const errors: FieldErrors = {};
  if (typeof name !== "string" || !name.trim()) errors.name = "Diga como podemos te chamar.";
  else if (name.trim().length > 60) errors.name = "Use até 60 caracteres.";
  if (!checkEmail(email)) errors.email = "Confira o e-mail: falta o @ ou o domínio.";
  if (!checkPassword(password)) errors.password = `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (Object.keys(errors).length) return fail(errors);

  const user = await createUser(name, email, password);
  if (!user) return fail({ email: "Já existe uma conta com este e-mail. Tente entrar." });

  await startSession(user.id);
  return { ok: true };
}

/*
 * Creates a one-time link to set a new password. Atol has no e-mail sender
 * configured yet, so the link is written to the server log; in development
 * it is also returned to the page so it can be opened right away. The answer
 * is the same whether or not the account exists.
 */
export async function requestReset(email: string): Promise<AuthResult> {
  if (!checkEmail(email)) return fail({ email: "Confira o e-mail: falta o @ ou o domínio." });

  const token = createResetToken(email);
  if (!token) return { ok: true };

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const link = `${origin}/login?redefinir=${token}`;
  console.info(`[atol] Link para nova senha de ${normalizeEmail(email)}: ${link}`);

  return process.env.NODE_ENV === "production" ? { ok: true } : { ok: true, devLink: link };
}

export async function setNewPassword(token: string, password: string): Promise<AuthResult> {
  if (!checkPassword(password)) return fail({ password: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` });
  if (typeof token !== "string" || !token) return fail({ form: "Este link não é válido." });

  const userId = await resetPassword(token, password);
  if (!userId) return fail({ form: "Este link expirou ou já foi usado. Peça um novo." });

  await startSession(userId);
  return { ok: true };
}

export async function signOut() {
  await endSession();
  redirect("/login");
}
