"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, Volume2, VolumeX } from "lucide-react";

import { requestReset, setNewPassword, signIn, signUp, type AuthResult, type FieldErrors } from "@/app/login/actions";
import { AtolLogo } from "@/components/shared/logo";
import { Sky } from "@/components/shared/sky";
import { playSound, setSoundOn, useSoundOn } from "@/lib/sound";

type Mode = "entrar" | "criar" | "recuperar" | "redefinir";

const COPY: Record<Mode, { title: string; lead: string; submit: string; busy: string }> = {
  entrar: {
    title: "Sua ilha está esperando.",
    lead: "Entre para ver suas tarefas, notas e hábitos.",
    submit: "Entrar",
    busy: "Entrando…",
  },
  criar: {
    title: "Faça do seu dia uma ilha.",
    lead: "Crie sua conta em menos de um minuto.",
    submit: "Criar conta",
    busy: "Criando sua conta…",
  },
  recuperar: {
    title: "Vamos recuperar seu acesso.",
    lead: "Informe seu e-mail e enviaremos um link para criar uma nova senha.",
    submit: "Enviar link",
    busy: "Enviando…",
  },
  redefinir: {
    title: "Escolha uma nova senha.",
    lead: "Depois de salvar, você entra direto. Outros aparelhos conectados saem da conta.",
    submit: "Salvar senha",
    busy: "Salvando…",
  },
};

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="login-field" data-invalid={error ? "" : undefined}>
      <label htmlFor={id} className="login-label">
        {label}
      </label>
      <div className="login-well">{children}</div>
      {error && (
        <p key={error} id={`${id}-erro`} className="login-error">
          {error}
        </p>
      )}
    </div>
  );
}

/*
 * The page's one motif: an atoll seen from above, drawn large behind the
 * form. A lagoon glow, a reef ring broken by two passes (the logo's geometry,
 * at r 300), a faint surf line outside it that turns very slowly, a few
 * islets resting on the reef and the island itself at the centre.
 */
function Atoll() {
  return (
    <svg className="login-atoll" viewBox="-500 -500 1000 1000" fill="none" aria-hidden focusable="false">
      <defs>
        <radialGradient id="login-lagoon" r="0.5">
          <stop offset="0" stopColor="#2fd3c0" stopOpacity="0.22" />
          <stop offset="0.55" stopColor="#2fd3c0" stopOpacity="0.08" />
          <stop offset="1" stopColor="#2fd3c0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="330" fill="url(#login-lagoon)" className="login-atoll-lagoon" />
      <g className="login-atoll-in">
        <g className="login-atoll-surf">
          <circle r="372" className="login-atoll-surf-line" />
          <circle cx="0" cy="-372" r="4" className="login-atoll-speck" />
          <circle cx="263" cy="263" r="3" className="login-atoll-speck" />
        </g>
        <path d="M 276.15 -117.22 A 300 300 0 0 1 -212.13 212.13" pathLength={1} className="login-atoll-reef" />
        <path d="M -289.78 77.65 A 300 300 0 0 1 117.22 -276.15" pathLength={1} className="login-atoll-reef login-atoll-reef-b" />
        <circle cx="0" cy="300" r="9" className="login-atoll-islet" />
        <circle cx="-300" cy="-10" r="6" className="login-atoll-islet" />
        <circle r="34" className="login-atoll-island" />
        <path d="M -392 -392 h 26 M -379 -405 v 26" className="login-atoll-cross" />
        <path d="M 360 360 h 22 M 371 349 v 22" className="login-atoll-cross" />
      </g>
    </svg>
  );
}

/* Sounds on/off, for the page that greets you first. */
function SoundToggle() {
  const on = useSoundOn();
  const toggle = () => {
    if (on) {
      playSound("toggle-off");
      setSoundOn(false);
    } else {
      setSoundOn(true);
      playSound("toggle-on");
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Sons"
      aria-pressed={on}
      title={on ? "Desligar sons" : "Ligar sons"}
      className="login-eye"
    >
      <span className="icon-swap" aria-hidden>
        <Volume2 className="size-[17px]" data-hidden={on ? undefined : ""} />
        <VolumeX className="size-[17px]" data-hidden={on ? "" : undefined} />
      </span>
    </button>
  );
}

/* After a successful sign-in: hold the check, then the page leaves, then go. */
const DONE_HOLD = 450;
const LEAVE = 380;

export function AtolLogin() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // A link from "Esqueci minha senha" lands here as /login?redefinir=<token>.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("redefinir");
    if (!token) return;
    // The URL is only readable after hydration; this runs once, on arrival.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResetToken(token);
    setMode("redefinir");
    window.history.replaceState(null, "", "/login");
  }, []);

  function switchMode(next: Mode) {
    if (next !== mode || sent) playSound("swap");
    setMode(next);
    setErrors({});
    setSent(false);
    setDevLink(null);
  }

  /* Quick feedback before the round trip; the server checks everything again. */
  function validate() {
    const next: FieldErrors = {};
    if (mode === "criar" && !name.trim()) next.name = "Diga como podemos te chamar.";
    if (mode !== "redefinir" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Confira o e-mail: falta o @ ou o domínio.";
    if (mode === "entrar" && !password) next.password = "Digite sua senha.";
    if ((mode === "criar" || mode === "redefinir") && password.length < 6)
      next.password = "A senha precisa ter pelo menos 6 caracteres.";
    setErrors(next);
    const ok = Object.keys(next).length === 0;
    if (!ok) playSound("error");
    return ok;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || done || !validate()) return;
    setBusy(true);

    let result: AuthResult;
    try {
      result =
        mode === "entrar"
          ? await signIn(email, password)
          : mode === "criar"
            ? await signUp(name, email, password)
            : mode === "recuperar"
              ? await requestReset(email)
              : await setNewPassword(resetToken ?? "", password);
    } catch {
      result = { ok: false, errors: { form: "Não foi possível falar com o servidor. Tente de novo." } };
    }
    setBusy(false);

    if (!result.ok) {
      setErrors(result.errors);
      playSound("error");
      return;
    }
    if (mode === "recuperar") {
      setDevLink(result.devLink ?? null);
      setSent(true);
      playSound("sent");
      return;
    }
    setDone(true);
    playSound("success");
    window.setTimeout(() => setLeaving(true), DONE_HOLD);
    window.setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, DONE_HOLD + LEAVE);
  }

  const copy = COPY[mode];
  const label = done ? "Tudo pronto" : busy ? copy.busy : copy.submit;

  return (
    <div data-leaving={leaving ? "" : undefined} className="login-root relative isolate flex min-h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {/* ---------- scenery: the night ocean of the home, and a drawn atoll ---------- */}
      <Sky />
      <div className="login-scene" aria-hidden>
        <div className="login-system">
          <Atoll />
        </div>
      </div>

      <header className="login-enter relative z-10 flex items-center justify-between px-5 pt-5 sm:px-10 sm:pt-8" style={{ "--i": 0 } as React.CSSProperties}>
        <Link href="/" aria-label="Atol, início" className="login-home inline-flex rounded-full">
          <AtolLogo size="md" />
        </Link>
        <div className="flex items-center gap-5">
          <p className="login-caps hidden sm:block">Seu dia é uma ilha</p>
          <SoundToggle />
        </div>
      </header>

      <main className="login-grid relative z-10 mx-auto w-full flex-1 px-5 py-10 sm:px-10 lg:py-6">
        <section className="login-intro login-enter" style={{ "--i": 1 } as React.CSSProperties}>
          <div key={mode} className="login-swap">
            <h1 className="login-title">{copy.title}</h1>
            <p className="mt-5 max-w-[34ch] text-[17px] leading-relaxed text-muted-foreground">{copy.lead}</p>
          </div>
          <p className="login-caps mt-10 hidden lg:block">
            Tarefas <span aria-hidden>•</span> Notas <span aria-hidden>•</span> Hábitos
          </p>
        </section>

        <section className="login-panel login-enter" style={{ "--i": 2 } as React.CSSProperties} aria-label={copy.submit}>
          {sent ? (
            <div role="status" className="login-swap">
              <p className="font-display text-[1.5rem] leading-tight font-bold tracking-[-0.03em]">Pronto, confira sua caixa de entrada.</p>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Se existir uma conta para{" "}
                <span className="text-foreground [overflow-wrap:anywhere]">{email.trim()}</span>, um link para criar
                uma nova senha foi gerado. Ele vale por 30 minutos.
              </p>
              {devLink && (
                <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                  Ainda não há envio de e-mail configurado, então em desenvolvimento o link aparece aqui:{" "}
                  <a href={devLink} className="login-link text-foreground">
                    abrir link
                  </a>
                </p>
              )}
              <button type="button" onClick={() => switchMode("entrar")} className="login-ghost mt-8">
                Voltar para entrar
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-7">
              {mode === "criar" && (
                <Field id="nome" label="Como podemos te chamar" error={errors.name}>
                  <input
                    id="nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="given-name"
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "nome-erro" : undefined}
                    placeholder="Seu nome"
                    className="login-input"
                  />
                </Field>
              )}

              {mode !== "redefinir" && (
              <Field id="email" label="E-mail" error={errors.email}>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-erro" : undefined}
                  placeholder="voce@email.com"
                  className="login-input"
                />
              </Field>
              )}

              {mode !== "recuperar" && (
                <Field id="senha" label={mode === "redefinir" ? "Nova senha" : "Senha"} error={errors.password}>
                  <input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "senha-erro" : undefined}
                    placeholder={mode === "entrar" ? "Sua senha" : "Mínimo de 6 caracteres"}
                    className="login-input"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      playSound(showPassword ? "toggle-off" : "toggle-on");
                      setShowPassword((v) => !v);
                    }}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    className="login-eye"
                  >
                    <span className="icon-swap" aria-hidden>
                      <Eye className="size-[17px]" data-hidden={showPassword ? "" : undefined} />
                      <EyeOff className="size-[17px]" data-hidden={showPassword ? undefined : ""} />
                    </span>
                  </button>
                </Field>
              )}

              {mode === "entrar" && (
                <button type="button" onClick={() => switchMode("recuperar")} className="login-link -mt-3 self-end text-[13px]">
                  Esqueci minha senha
                </button>
              )}

              {errors.form && (
                <p key={errors.form} role="alert" className="login-error -mt-2">
                  {errors.form}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || done}
                data-busy={busy ? "" : undefined}
                data-done={done ? "" : undefined}
                className="login-submit mt-2"
              >
                <span aria-live="polite" className="login-submit-label">
                  <span key={label} className="login-label-swap">
                    {label}
                  </span>
                </span>
                <span className="login-submit-knob icon-swap" aria-hidden>
                  <ArrowRight className="login-submit-arrow size-[18px]" data-hidden={busy || done ? "" : undefined} />
                  <LoaderCircle className={`size-[18px] ${busy ? "animate-spin" : ""}`} data-hidden={busy ? undefined : ""} />
                  <Check className="size-[18px]" strokeWidth={2.5} data-hidden={done ? undefined : ""} />
                </span>
              </button>
            </form>
          )}

          <div className="mt-8 text-[14px] text-muted-foreground">
            {mode === "entrar" ? (
              <p>
                Ainda não tem conta?{" "}
                <button type="button" onClick={() => switchMode("criar")} className="login-link font-medium text-foreground">
                  Criar conta
                </button>
              </p>
            ) : (
              <p>
                Já tem conta?{" "}
                <button type="button" onClick={() => switchMode("entrar")} className="login-link font-medium text-foreground">
                  Entrar
                </button>
              </p>
            )}
          </div>
        </section>
      </main>

      <footer
        className="login-enter relative z-10 flex items-center justify-between px-5 pb-5 sm:px-10 sm:pb-8"
        style={{ "--i": 3 } as React.CSSProperties}
      >
        <p className="login-caps">© 2026 Atol</p>
        <p className="login-caps hidden sm:block">Feito para dias calmos</p>
      </footer>
    </div>
  );
}
