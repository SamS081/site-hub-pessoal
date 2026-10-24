"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useSpring,
  type Variants,
} from "motion/react";
import { ArrowDown, Check, LogOut, Plus, Trash2, Undo2, Volume2, VolumeX, X } from "lucide-react";

import { signOut } from "@/app/login/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AtolMark } from "@/components/orbita/logo";
import { FieldScene } from "@/components/habitos/field-scene";
import { dateKey, useNow, useOrbita, weekOf, type Habit } from "@/lib/orbita";
import { holdTone, playSound, setSoundOn, useSoundOn } from "@/lib/sound";

/*
 * Hábitos: "Lavanda". A field at the blue hour, a lone figure on the hill
 * and a slow vortex of cloud turning above the horizon (field-scene.tsx):
 * what you repeat, grows. The field is today's habits: buds when none are
 * kept, full lilac when all are; keeping one sends a gust of wind across it.
 *
 * The first screen is laid out like an editorial cover: a glass pill of
 * sections at the top centre, the big light word at the lower left with its
 * quiet second line, an outlined button, a hairline, and a footer row of
 * small text. Scrolling moves the layers at their own speeds (parallax) and
 * leads to the ritual: one card per habit, kept by pressing and holding,
 * with the week's seven flowers and the streak; then twelve weeks of field.
 *
 * Its own identity, apart from the night-ocean Atol, the Tarefas forest and
 * the Notas sky: blue-hour indigo ground, pale periwinkle ink, lilac as the
 * one accent (kept, today, the primary action), Hanken Grotesk set light
 * and large. Its own sounds too (flute and wind chimes, lib/sound.ts "hab-*").
 *
 * Data is the same local store as the home (lib/orbita.ts), per account.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;
const HOLD_MS = 720;
const WEEKDAY_INITIALS = ["S", "T", "Q", "Q", "S", "S", "D"];
const SUGGESTIONS = ["Ler 10 páginas", "Caminhar 20 min", "Alongar ao acordar", "Escrever 3 linhas"];

/* ---------- dates and streaks ---------- */

function fromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shiftKey(key: string, days: number) {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/* Days in a row up to today; a day not kept yet today does not break it. */
function streakOf(h: Habit, today: string) {
  const kept = new Set(h.doneOn);
  let k = kept.has(today) ? today : shiftKey(today, -1);
  let n = 0;
  while (kept.has(k)) {
    n++;
    k = shiftKey(k, -1);
  }
  return n;
}

function bestOf(h: Habit) {
  const keys = [...new Set(h.doneOn)].sort();
  let best = 0;
  let run = 0;
  keys.forEach((k, i) => {
    run = i > 0 && shiftKey(keys[i - 1], 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const weekdayLong = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && !!el.closest("input, textarea, [contenteditable], [role=menu], [role=dialog]");

/* A gust of wind across the field, from where the pointer was. */
const gust = (clientX?: number) =>
  window.dispatchEvent(new CustomEvent("lav:gust", { detail: { x: clientX === undefined ? 0.3 : clientX / window.innerWidth } }));

/* A button that leans toward the mouse a little. */
function useMagnet(strength = 0.22) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.6 });
  return {
    style: { x: sx, y: sy },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse") return;
      const r = e.currentTarget.getBoundingClientRect();
      x.set((e.clientX - (r.left + r.width / 2)) * strength);
      y.set((e.clientY - (r.top + r.height / 2)) * strength);
    },
    onPointerLeave: () => {
      x.set(0);
      y.set(0);
    },
  };
}

/* A small five-petal flower: the page's mark for a kept day. */
function Flower({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cx="10" cy="5.6" rx="3.1" ry="4.4" transform={`rotate(${r} 10 10)`} />
      ))}
      <circle cx="10" cy="10" r="2.4" className="lav-flower-heart" />
    </svg>
  );
}

/* ---------- header: a glass pill at the top centre ---------- */

const SECTIONS = [
  { label: "Hoje", href: "/" },
  { label: "Tarefas", href: "/tarefas" },
  { label: "Notas", href: "/notas" },
  { label: "Hábitos", href: "/habitos", current: true },
];

function SoundItem() {
  const on = useSoundOn();
  return (
    <DropdownMenuItem
      closeOnClick={false}
      onClick={() => {
        if (on) {
          playSound("toggle-off");
          setSoundOn(false);
        } else {
          setSoundOn(true);
          playSound("hab-keep");
        }
      }}
      className="h-10 gap-2.5 px-2.5 text-(--muted-foreground) data-highlighted:text-(--foreground)"
    >
      {on ? <Volume2 strokeWidth={1.6} /> : <VolumeX strokeWidth={1.6} />}
      Sons
      <span className="ml-auto text-xs">{on ? "ligados" : "desligados"}</span>
    </DropdownMenuItem>
  );
}

function Header({ name }: { name: string }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > 40);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: EASE, delay: 0.3 }}
      className="lav-header"
    >
      <nav aria-label="Seções" className="lav-pill" data-scrolled={scrolled ? "" : undefined}>
        <Link href="/" aria-label="Atol, voltar para Hoje" className="lav-pill-mark" onClick={() => playSound("hab-tick")}>
          <AtolMark tone="mono" className="size-[1.375rem]" />
        </Link>
        <ul className="flex items-center">
          <li className="sm:hidden">
            <Link href="/" className="lav-pill-link">
              Hoje
            </Link>
          </li>
          {SECTIONS.map((s) => (
            <li key={s.label} className={s.current ? "" : "hidden sm:block"}>
              <Link
                href={s.href}
                aria-current={s.current ? "page" : undefined}
                className="lav-pill-link"
                onClick={() => !s.current && playSound("hab-tick")}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
        <DropdownMenu onOpenChange={(open) => playSound(open ? "hab-open" : "hab-close")}>
          <DropdownMenuTrigger aria-label={`Menu da conta de ${name}`} className="lav-pill-avatar">
            {name.trim().charAt(0).toUpperCase()}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={10} className="lav-menu w-60">
            <p className="truncate px-2.5 pt-2 pb-2.5 text-sm font-medium">{name}</p>
            <DropdownMenuSeparator />
            <SoundItem />
            <DropdownMenuItem
              onClick={() => void signOut()}
              className="h-10 gap-2.5 px-2.5 text-(--muted-foreground) data-highlighted:text-(--foreground)"
            >
              <LogOut strokeWidth={1.6} />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </motion.header>
  );
}

/* ---------- hero ---------- */

const rise: Variants = {
  hidden: { y: "105%" },
  show: (delay: number) => ({ y: "0%", transition: { duration: 1.2, ease: EASE, delay } }),
};

function Hero({
  habits,
  keptToday,
  now,
  onRitual,
}: {
  habits: Habit[];
  keptToday: number;
  now: Date;
  onRitual: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const total = habits.length;
  const bloom = total ? keptToday / total : 0;
  const magnet = useMagnet(0.25);

  const field =
    total === 0
      ? "O campo ainda está em botão. Plante o primeiro hábito e veja o que nasce."
      : keptToday === 0
        ? `Nenhum dos ${total} hábitos de hoje ainda. O campo espera, em botão.`
        : keptToday === total
          ? `${total} de ${total} hábitos hoje. O campo inteiro floresceu.`
          : `${keptToday} de ${total} hábitos hoje. O campo está abrindo.`;

  return (
    <section aria-labelledby="lav-titulo" className="lav-hero">
      <FieldScene bloom={bloom} />

      <div className="lav-hero-body">
        <div className="lav-hero-row">
          <h1 id="lav-titulo" className="lav-title">
            <span className="block overflow-hidden pb-[0.06em]">
              <motion.span className="block" variants={rise} custom={0.5} initial="hidden" animate="show">
                Hábitos
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-[0.08em]">
              <motion.span className="lav-title-sub block" variants={rise} custom={0.68} initial="hidden" animate="show">
                O que se repete, floresce.
              </motion.span>
            </span>
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 1.05 }}
            className="lav-hero-cta"
          >
            <motion.button type="button" onClick={onRitual} className="lav-btn lav-btn-outline" {...magnet}>
              Começar o ritual
              <ArrowDown className="lav-bob size-4" strokeWidth={1.8} aria-hidden />
            </motion.button>
          </motion.div>
        </div>

        <motion.hr
          className="lav-rule"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.4, ease: EASE, delay: 0.9 }}
        />

        <motion.div
          className="lav-hero-foot"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 1.25 }}
        >
          <p className="lav-small">Um gesto pequeno, todo dia.</p>
          <p className="lav-small hidden md:block">{capitalize(weekdayLong(now))}</p>
          <div className="lav-hero-text" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={field}
                initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                {field}
              </motion.p>
            </AnimatePresence>
            <p className="hidden sm:block">
              Cada hábito cumprido é um sopro de vento sobre o campo. Menos pressa. Mais raiz.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- hold to keep ---------- */

/* Petals thrown out of the button when a habit is kept. */
function Burst() {
  return (
    <span aria-hidden className="lav-burst">
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const d = 38 + (i % 3) * 14;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
            animate={{ x: Math.cos(a) * d + 18, y: Math.sin(a) * d - 22, opacity: 0, scale: 1, rotate: (i % 2 ? 1 : -1) * 160 }}
            transition={{ duration: 1, ease: EASE }}
          />
        );
      })}
    </span>
  );
}

/*
 * Keeping a habit is a small ritual: press and hold until the lilac fills
 * the button (a gust of wind rises under it). A quick tap only says "hold".
 * Kept, one tap takes it back. From the keyboard, Enter or Space keeps it.
 */
function HoldButton({
  kept,
  name,
  onKeep,
  onUnkeep,
}: {
  kept: boolean;
  name: string;
  onKeep: (clientX?: number) => void;
  onUnkeep: () => void;
}) {
  const p = useMotionValue(kept ? 1 : 0);
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const [bursts, setBursts] = useState(0);
  const timer = useRef(0);
  const started = useRef(0);
  const pressX = useRef<number | undefined>(undefined);
  const stopTone = useRef<(done?: boolean) => void>(() => {});
  const justKept = useRef(false);
  const anim = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    if (!holding) {
      anim.current?.stop();
      anim.current = animate(p, kept ? 1 : 0, { duration: kept ? 0.3 : 0.45, ease: EASE });
    }
  }, [kept, holding, p]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      stopTone.current();
    },
    [],
  );

  const complete = () => {
    setHolding(false);
    justKept.current = true;
    stopTone.current(true);
    setBursts((n) => n + 1);
    navigator.vibrate?.(14);
    onKeep(pressX.current);
  };

  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (kept || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pressX.current = e.clientX;
    setHolding(true);
    setHint(false);
    started.current = performance.now();
    anim.current?.stop();
    anim.current = animate(p, 1, { duration: (HOLD_MS / 1000) * (1 - p.get()), ease: "linear" });
    stopTone.current = holdTone(HOLD_MS);
    timer.current = window.setTimeout(complete, HOLD_MS * (1 - p.get()));
  };

  const up = () => {
    if (!holding) return;
    window.clearTimeout(timer.current);
    stopTone.current();
    setHolding(false);
    if (performance.now() - started.current < 220) {
      setHint(true);
      playSound("hab-nope");
    }
  };

  const click = (e: MouseEvent<HTMLButtonElement>) => {
    if (justKept.current) {
      justKept.current = false;
      return;
    }
    if (kept) {
      onUnkeep();
    } else if (e.detail === 0) {
      // Keyboard activation: no hold.
      setBursts((n) => n + 1);
      const r = e.currentTarget.getBoundingClientRect();
      onKeep(r.left + r.width / 2);
    }
  };

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(false), 1800);
    return () => window.clearTimeout(id);
  }, [hint]);

  return (
    <motion.button
      type="button"
      aria-pressed={kept}
      aria-label={kept ? `${name}: cumprido hoje. Desfazer` : `Cumprir hoje: ${name}`}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onClick={click}
      onContextMenu={(e) => e.preventDefault()}
      data-kept={kept ? "" : undefined}
      data-holding={holding ? "" : undefined}
      className="lav-hold"
      style={{ "--p": p } as unknown as React.CSSProperties}
      animate={hint ? { x: [0, -5, 5, -3, 0] } : { x: 0 }}
      transition={{ duration: 0.36 }}
    >
      <span aria-hidden className="lav-hold-fill" />
      <span className="lav-hold-label">
        <span className="lav-hold-icon" aria-hidden>
          {kept ? <Check className="size-4" strokeWidth={2.4} /> : <Flower className="lav-hold-flower" />}
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={kept ? "kept" : hint ? "hint" : holding ? "holding" : "idle"}
            initial={{ y: "70%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-70%", opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="inline-block"
          >
            {kept ? "Floresceu hoje" : hint ? "Segure um instante…" : holding ? "Segurando…" : "Segure para cumprir"}
          </motion.span>
        </AnimatePresence>
      </span>
      {kept && <span className="lav-hold-undo">desfazer</span>}
      {bursts > 0 && <Burst key={bursts} />}
    </motion.button>
  );
}

/* ---------- ritual ---------- */

function WeekFlowers({
  habit,
  week,
  today,
  onDay,
}: {
  habit: Habit;
  week: Date[];
  today: string;
  onDay: (key: string, step: number) => void;
}) {
  return (
    <ol className="lav-week" aria-label={`Semana de ${habit.name}`}>
      {week.map((d, i) => {
        const k = dateKey(d);
        const kept = habit.doneOn.includes(k);
        const future = k > today;
        return (
          <li key={k}>
            <span aria-hidden className="lav-week-day" data-today={k === today ? "" : undefined}>
              {WEEKDAY_INITIALS[i]}
            </span>
            <button
              type="button"
              disabled={future}
              aria-pressed={kept}
              aria-label={`${habit.name}, ${weekdayLong(d)}${k === today ? " (hoje)" : ""}`}
              title={capitalize(weekdayLong(d))}
              onClick={() => onDay(k, i)}
              data-kept={kept ? "" : undefined}
              data-today={k === today ? "" : undefined}
              className="lav-day"
            >
              <span className="lav-day-bud" />
              <Flower className="lav-day-flower" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function HabitCard({
  habit,
  index,
  week,
  today,
  onToday,
  onDay,
  onRemove,
}: {
  habit: Habit;
  index: number;
  week: Date[];
  today: string;
  onToday: (keep: boolean, clientX?: number) => void;
  onDay: (key: string, step: number) => void;
  onRemove: () => void;
}) {
  const kept = habit.doneOn.includes(today);
  const streak = streakOf(habit, today);
  const best = bestOf(habit);
  const weekCount = week.filter((d) => habit.doneOn.includes(dateKey(d))).length;

  const spot = (e: ReactPointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      exit={{ opacity: 0, scale: 0.94, filter: "blur(8px)", transition: { duration: 0.35, ease: EASE } }}
      transition={{ duration: 0.8, ease: EASE, delay: Math.min(index, 6) * 0.07, layout: SPRING }}
      onPointerMove={spot}
      data-kept={kept ? "" : undefined}
      className="lav-card"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="lav-card-index">{String(index + 1).padStart(2, "0")}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Apagar hábito: ${habit.name}`}
          title="Apagar"
          className="lav-btn lav-mini lav-card-remove"
        >
          <Trash2 className="size-4" strokeWidth={1.6} aria-hidden />
        </button>
      </div>

      <h3 className="lav-card-title">{habit.name}</h3>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="lav-figure overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={streak}
                className="inline-block"
                initial={{ y: "60%", opacity: 0, filter: "blur(4px)" }}
                animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                exit={{ y: "-60%", opacity: 0, filter: "blur(4px)" }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                {streak}
              </motion.span>
            </AnimatePresence>
          </p>
          <p className="lav-small mt-1.5">{streak === 0 ? "comece hoje" : streak === 1 ? "dia seguido" : "dias seguidos"}</p>
        </div>
        <p className="lav-mono pb-0.5 text-right">
          {weekCount}/7 na semana
          <br />
          recorde {best} {best === 1 ? "dia" : "dias"}
        </p>
      </div>

      <WeekFlowers habit={habit} week={week} today={today} onDay={onDay} />

      <HoldButton
        kept={kept}
        name={habit.name}
        onKeep={(x) => onToday(true, x)}
        onUnkeep={() => onToday(false)}
      />
    </motion.li>
  );
}

function NewHabit({
  editing,
  setEditing,
  onCreate,
}: {
  editing: boolean;
  setEditing: (on: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [shake, setShake] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus({ preventScroll: true });
  }, [editing]);

  const close = () => {
    setEditing(false);
    setName("");
    playSound("hab-close");
  };

  const submit = (e?: FormEvent, text = name) => {
    e?.preventDefault();
    const clean = text.trim().slice(0, 60);
    if (!clean) {
      setShake((n) => n + 1);
      playSound("hab-nope");
      inputRef.current?.focus();
      return;
    }
    onCreate(clean);
    setName("");
    inputRef.current?.focus();
  };

  return (
    <motion.li layout transition={{ layout: SPRING }} className="lav-new" data-editing={editing ? "" : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        {!editing ? (
          <motion.button
            key="tile"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: EASE }}
            onClick={() => {
              setEditing(true);
              playSound("hab-open");
            }}
            className="lav-new-btn"
          >
            <span className="lav-new-plus">
              <Plus className="size-5" strokeWidth={1.8} aria-hidden />
            </span>
            <span className="lav-new-label">Plantar um hábito</span>
            <span className="lav-mono">
              aperte <kbd>N</kbd>
            </span>
          </motion.button>
        ) : (
          <motion.form
            key={`form-${shake}`}
            onSubmit={submit}
            initial={{ opacity: 0, y: 10 }}
            animate={shake ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 0] } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="flex h-full flex-col"
            onKeyDown={(e: ReactKeyboardEvent) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
          >
            <div className="flex items-center justify-between">
              <span className="lav-small flex items-center gap-2">
                <Flower className="lav-inline-flower" />
                Novo hábito
              </span>
              <button type="button" onClick={close} aria-label="Cancelar" className="lav-btn lav-mini">
                <X className="size-4" strokeWidth={1.6} aria-hidden />
              </button>
            </div>
            <label htmlFor="lav-novo" className="sr-only">
              Nome do hábito
            </label>
            <input
              ref={inputRef}
              id="lav-novo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="O que você quer repetir?"
              autoComplete="off"
              maxLength={60}
              className="lav-new-input"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => submit(undefined, s)} className="lav-btn lav-chip">
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <span className="lav-mono hidden sm:inline">Enter planta · Esc fecha</span>
              <button type="submit" className="lav-btn lav-btn-solid ml-auto">
                Plantar
                <Plus className="size-4" strokeWidth={2} aria-hidden />
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function Ritual({
  habits,
  week,
  today,
  now,
  keptToday,
  adding,
  setAdding,
  onToday,
  onDay,
  onRemove,
  onCreate,
}: {
  habits: Habit[];
  week: Date[];
  today: string;
  now: Date;
  keptToday: number;
  adding: boolean;
  setAdding: (on: boolean) => void;
  onToday: (h: Habit, keep: boolean, clientX?: number) => void;
  onDay: (h: Habit, key: string, step: number) => void;
  onRemove: (h: Habit) => void;
  onCreate: (name: string) => void;
}) {
  const marks = habits.reduce((n, h) => n + week.filter((d) => h.doneOn.includes(dateKey(d))).length, 0);
  const elapsed = week.filter((d) => dateKey(d) <= today).length;
  const weekShare = habits.length ? Math.round((marks / (habits.length * elapsed)) * 100) : 0;
  const longest = habits.reduce<{ n: number; name: string }>(
    (a, h) => {
      const n = streakOf(h, today);
      return n > a.n ? { n, name: h.name } : a;
    },
    { n: 0, name: "" },
  );

  return (
    <section id="ritual" aria-labelledby="ritual-titulo" className="lav-section">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="lav-section-head"
      >
        <div>
          <p className="lav-small">{capitalize(weekdayLong(now))}</p>
          <h2 id="ritual-titulo" className="lav-section-title">
            Ritual de hoje
            <span>Segure cada um até florescer.</span>
          </h2>
        </div>

        <dl className="lav-stats">
          <div>
            <dt className="lav-small">Hoje</dt>
            <dd className="lav-figure-sm">
              {keptToday}
              <span>/{habits.length}</span>
            </dd>
          </div>
          <div>
            <dt className="lav-small">Semana</dt>
            <dd className="lav-figure-sm">
              {weekShare}
              <span>%</span>
            </dd>
          </div>
          <div>
            <dt className="lav-small">Maior sequência</dt>
            <dd className="lav-figure-sm" title={longest.name || undefined}>
              {longest.n}
              <span> {longest.n === 1 ? "dia" : "dias"}</span>
            </dd>
          </div>
        </dl>
      </motion.div>

      <LayoutGroup>
        <motion.ul layout className="lav-grid">
          <AnimatePresence mode="popLayout">
            {habits.map((h, i) => (
              <HabitCard
                key={h.id}
                habit={h}
                index={i}
                week={week}
                today={today}
                onToday={(keep, x) => onToday(h, keep, x)}
                onDay={(k, step) => onDay(h, k, step)}
                onRemove={() => onRemove(h)}
              />
            ))}
          </AnimatePresence>
          <NewHabit editing={adding} setEditing={setAdding} onCreate={onCreate} />
        </motion.ul>
      </LayoutGroup>
    </section>
  );
}

/* ---------- the field of the last twelve weeks ---------- */

function Trail({ habits, today }: { habits: Habit[]; today: string }) {
  const weeks = useMemo(() => {
    const end = fromKey(today);
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(end);
      d.setDate(end.getDate() - (11 - i) * 7);
      return weekOf(d);
    });
  }, [today]);

  const days = weeks.flat();
  const shareOf = (k: string) => (habits.length ? habits.filter((h) => h.doneOn.includes(k)).length / habits.length : 0);
  const bloomed = days.filter((d) => dateKey(d) <= today && shareOf(dateKey(d)) > 0).length;
  const full = days.filter((d) => dateKey(d) <= today && habits.length > 0 && shareOf(dateKey(d)) === 1).length;

  return (
    <section aria-labelledby="trilha-titulo" className="lav-section lav-trail-section">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="lav-trail-wrap"
      >
        <div>
          <p className="lav-small">Últimas 12 semanas</p>
          <h2 id="trilha-titulo" className="lav-section-title">
            O campo
            <span>que você plantou.</span>
          </h2>
          <p className="lav-body mt-6 max-w-[32ch]">
            Cada dia é uma flor. Quanto mais hábitos cumpridos, mais aberta e mais clara ela fica.
          </p>
          <dl className="lav-stats mt-10">
            <div>
              <dt className="lav-small">Dias floridos</dt>
              <dd className="lav-figure-sm">{bloomed}</dd>
            </div>
            <div>
              <dt className="lav-small">Dias completos</dt>
              <dd className="lav-figure-sm">{full}</dd>
            </div>
          </dl>
        </div>

        <div className="lav-trail">
          <ol aria-hidden className="lav-trail-days">
            {WEEKDAY_INITIALS.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ol>
          <ol className="lav-trail-grid" aria-label="Dias das últimas 12 semanas">
            {days.map((d, i) => {
              const k = dateKey(d);
              const share = shareOf(k);
              const future = k > today;
              const kept = habits.filter((h) => h.doneOn.includes(k)).length;
              const label = `${capitalize(weekdayLong(d))}: ${future ? "ainda não chegou" : `${kept} de ${habits.length}`}`;
              return (
                <motion.li
                  key={k}
                  initial={{ opacity: 0, scale: 0.3, rotate: -40 }}
                  whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, ease: EASE, delay: Math.floor(i / 7) * 0.045 + (i % 7) * 0.02 }}
                  data-future={future ? "" : undefined}
                  data-today={k === today ? "" : undefined}
                  data-empty={!future && share === 0 ? "" : undefined}
                  style={{ "--s": future ? 0 : share } as React.CSSProperties}
                  title={label}
                >
                  <Flower className="lav-trail-flower" />
                  <span className="sr-only">{label}</span>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </motion.div>

      <footer className="lav-footer">
        <span>Atol · Hábitos</span>
        <span className="lav-footer-mid">Seu dia é uma ilha. O que se repete, floresce.</span>
        <span>{new Date().getFullYear()}</span>
      </footer>
    </section>
  );
}

/* ---------- the page ---------- */

export default function HabitsPage({ user }: { user: { id: string; name: string } }) {
  const { data, toggleHabit, addHabit, removeHabit, restoreHabit } = useOrbita(user.id);
  const now = useNow();
  const today = dateKey(now);
  const week = useMemo(() => weekOf(fromKey(today)), [today]);
  const [adding, setAdding] = useState(false);
  const [undo, setUndo] = useState<{ habit: Habit; index: number } | null>(null);

  const habits = data.habits;
  const keptToday = habits.filter((h) => h.doneOn.includes(today)).length;

  const toRitual = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    playSound("hab-open");
    gust(e.clientX);
    document.getElementById("ritual")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  function setToday(h: Habit, keep: boolean, clientX?: number) {
    if (h.doneOn.includes(today) === keep) return;
    toggleHabit(h.id, today);
    if (keep) {
      gust(clientX);
      playSound(keptToday + 1 === habits.length ? "hab-bloom" : "hab-keep");
    } else {
      playSound("hab-unkeep");
    }
  }

  function toggleDay(h: Habit, key: string, step: number) {
    const keep = !h.doneOn.includes(key);
    toggleHabit(h.id, key);
    playSound(keep ? "hab-day" : "hab-day-off", { step });
  }

  function create(name: string) {
    addHabit(name);
    playSound("hab-create");
  }

  function remove(h: Habit) {
    const index = habits.findIndex((x) => x.id === h.id);
    removeHabit(h.id);
    setUndo({ habit: h, index });
    playSound("hab-delete");
  }

  function restore() {
    if (!undo) return;
    restoreHabit(undo.habit, undo.index);
    setUndo(null);
    playSound("hab-undo");
  }

  // The undo offer lasts six seconds.
  useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(id);
  }, [undo]);

  // N: new habit. Ctrl+Z: undo the last delete.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.altKey) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && undo) {
        e.preventDefault();
        restore();
        return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        document.getElementById("ritual")?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (!adding) playSound("hab-open");
        setAdding(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <MotionConfig reducedMotion="user">
      <Header name={user.name} />
      <main>
        <Hero habits={habits} keptToday={keptToday} now={now} onRitual={toRitual} />
        <Ritual
          habits={habits}
          week={week}
          today={today}
          now={now}
          keptToday={keptToday}
          adding={adding}
          setAdding={setAdding}
          onToday={setToday}
          onDay={toggleDay}
          onRemove={remove}
          onCreate={create}
        />
        <Trail habits={habits} today={today} />
      </main>

      <div aria-live="polite" className="lav-toast-slot">
        <AnimatePresence>
          {undo && (
            <motion.div
              key={undo.habit.id}
              initial={{ opacity: 0, y: 24, scale: 0.9, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 16, scale: 0.95, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="lav-toast"
            >
              <span className="min-w-0 truncate">
                Hábito apagado<span className="hidden sm:inline">: {undo.habit.name}</span>
              </span>
              <button type="button" onClick={restore} className="lav-btn lav-toast-btn">
                <Undo2 className="size-4" strokeWidth={1.8} aria-hidden />
                Desfazer
              </button>
              <motion.span
                aria-hidden
                className="lav-toast-timer"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 6, ease: "linear" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
