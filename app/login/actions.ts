"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  checkCredentials,
  clearFailedSignIns,
  createResetToken,
  createUser,
  endSession,
  isSignInLocked,
  normalizeEmail,
  recordFailedSignIn,
  resetPassword,
  startSession,
} from "@/lib/auth";
import { mailEnabled, sendMail } from "@/lib/mail";

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

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!checkEmail(email)) return fail({ email: "Confira o e-mail: falta o @ ou o domínio." });
  if (typeof password !== "string" || !password) return fail({ password: "Digite sua senha." });

  if (await isSignInLocked(email)) {
    return fail({ form: "Muitas tentativas. Espere um minuto e tente de novo." });
  }

  const user = await checkCredentials(email, password);
  if (!user) {
    await recordFailedSignIn(email);
    return fail({ form: "E-mail ou senha não conferem." });
  }

  await clearFailedSignIns(email);
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

const isProduction = process.env.NODE_ENV === "production";

/*
 * The site's address for links in e-mails. In production it must come from
 * SITE_URL: the Host header is set by whoever sends the request, so a link
 * built from it could point a reset token at someone else's site.
 */
async function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  if (isProduction) return null;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/*
 * Creates a one-time link to set a new password and e-mails it. Without an
 * e-mail sender (see lib/mail.ts) the reset is off in production; in
 * development the link is logged and returned to the page so it can be
 * opened right away. The answer is the same whether or not the account
 * exists.
 */
export async function requestReset(email: string): Promise<AuthResult> {
  if (!checkEmail(email)) return fail({ email: "Confira o e-mail: falta o @ ou o domínio." });

  const site = await siteUrl();
  if ((isProduction && !mailEnabled()) || !site) {
    return fail({ form: "A recuperação de senha ainda não está disponível. Fale com quem cuida do Atol." });
  }

  const token = await createResetToken(email);
  if (!token) return { ok: true };

  const link = `${site}/login?redefinir=${token}`;
  if (mailEnabled()) {
    await sendMail(
      normalizeEmail(email),
      "Sua nova senha do Atol",
      `Alguém pediu uma nova senha para esta conta do Atol.\n\nPara escolher a nova senha, abra o link abaixo. Ele vale por 30 minutos e funciona uma vez só:\n${link}\n\nSe não foi você, pode ignorar este e-mail. Sua senha continua a mesma.`,
    );
  }
  if (isProduction) return { ok: true };

  console.info(`[atol] Link para nova senha de ${normalizeEmail(email)}: ${link}`);
  return { ok: true, devLink: link };
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
