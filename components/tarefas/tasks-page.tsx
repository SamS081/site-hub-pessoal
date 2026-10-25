"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, type Variants } from "motion/react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Leaf,
  LogOut,
  Sprout,
  Volume2,
  VolumeX,
} from "lucide-react";

import { signOut } from "@/app/login/actions";
import { navTypes } from "@/components/shared/sections";
import { Ambience, useParallax } from "@/components/tarefas/ambience";
import { Composer, GroupHead, NowLine, TaskRow, UndoToast } from "@/components/tarefas/task-parts";
import { PERIODS, periodOf } from "@/components/tarefas/time";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dateKey, minutesOf, useNow, useOrbita, weekOf, type Task } from "@/lib/orbita";
import { playSound, setSoundOn, useSoundOn } from "@/lib/sound";

/*
 * Tarefas: the day's list in a forest. The page opens on a centred hero:
 * the date with its arrows, the huge title crossing the veil's edge at the
 * centre of the screen (cut out of the veil on the left, solid on the
 * right), the day in a light italic, and how the day stands. Scrolling (or
 * "Ver lista") brings up the board: the list with its add field and filter,
 * and beside it the week and a short tally. The forest behind is flat layers
 * with parallax (ambience.tsx), no 3D.
 *
 * Data is the same local store as the home (lib/orbita.ts), per account.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

type Filter = "todas" | "pendentes" | "feitas";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "pendentes", label: "Pendentes" },
  { id: "feitas", label: "Feitas" },
];

function fromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shiftKey(key: string, days: number) {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

function daysBetween(a: string, b: string) {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* "de hoje", "de amanhã", "do dia 26": the title's second line. */
function dayLine(offset: number, date: Date) {
  if (offset === 0) return "de hoje";
  if (offset === 1) return "de amanhã";
  if (offset === -1) return "de ontem";
  return `do dia ${date.getDate()}`;
}

function byTime(a: Task, b: Task) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.time && b.time) return minutesOf(a.time) - minutesOf(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return 0;
}

/* ---------- header ---------- */

function Wordmark() {
  return (
    <Link href="/" transitionTypes={navTypes("/tarefas", "/")} aria-label="Atol, voltar para Hoje" className="group flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-(--mata-leaf)">
      <span className="mata-glass grid size-11 place-items-center rounded-2xl transition-transform duration-500 ease-(--mata-spring) group-hover:rotate-[-8deg]">
        <Leaf className="size-5 text-(--mata-leaf)" strokeWidth={2} aria-hidden />
      </span>
      <span className="leading-none">
        <span className="mata-display block text-[1.35rem] tracking-[0.02em] normal-case">Atol</span>
        <span className="mata-caps mt-1 hidden text-[0.625rem] whitespace-nowrap text-(--mata-leaf) sm:block">Suas tarefas</span>
      </span>
    </Link>
  );
}

const SECTIONS = [
  { label: "Hoje", href: "/" },
  { label: "Tarefas", href: "/tarefas", current: true },
  { label: "Notas", href: "/notas" },
  { label: "Hábitos", href: "/habitos" },
];

/* A section that is not there yet: a small shake and a soft low note. */
function hold(event: MouseEvent<HTMLButtonElement>) {
  const el = event.currentTarget;
  el.classList.remove("mata-nudge");
  void el.offsetWidth;
  el.classList.add("mata-nudge");
  playSound("nope");
}

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
          playSound("toggle-on");
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

/* Sticky; turns to frosted glass once the page has scrolled. */
function Header({ name, scrolled }: { name: string; scrolled: boolean }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
      data-scrolled={scrolled ? "" : undefined}
      className="mata-header sticky top-0 z-30"
    >
      <div className="flex h-18 items-center justify-between gap-6 px-(--mata-gutter) lg:h-22">
        <Wordmark />

        <div className="flex items-center gap-3 md:gap-8">
          <nav aria-label="Seções" className="hidden md:block">
            <ul className="flex items-center gap-[clamp(1.5rem,2.6vw,2.75rem)]">
              {SECTIONS.map((s) => (
                <li key={s.label}>
                  {s.href ? (
                    <Link href={s.href} transitionTypes={navTypes("/tarefas", s.href)} aria-current={s.current ? "page" : undefined} className="mata-nav-link">
                      {s.label}
                    </Link>
                  ) : (
                    <button type="button" onClick={hold} title="Em breve" aria-disabled="true" className="mata-nav-link cursor-default">
                      {s.label}
                      <span className="sr-only"> (em breve)</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <DropdownMenu onOpenChange={(open) => playSound(open ? "open" : "close")}>
            <DropdownMenuTrigger
              aria-label={`Menu da conta de ${name}`}
              className="mata-btn mata-glass h-11 max-w-[11rem] rounded-full p-1.5 text-sm font-semibold outline-none sm:pr-4"
            >
              <span className="grid size-8 place-items-center rounded-full bg-(--mata-leaf) text-[0.8125rem] font-extrabold text-(--mata-on-leaf)">
                {name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="hidden truncate sm:inline">{name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="mata-menu w-60">
              <p className="truncate px-2.5 pt-2 pb-2.5 text-sm font-semibold">{name}</p>
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
        </div>
      </div>
    </motion.header>
  );
}

/* ---------- title ---------- */

/*
 * "TAREFAS" is set twice in the same centred box, animated identically:
 * the cut-out copy (the photo through the letters) clipped to the left half
 * and the solid copy clipped to the right half; a drop shadow on the pair
 * lifts the letters off the ground. The box is centred on the screen, so its middle
 * is exactly the veil's edge.
 */
const letter: Variants = {
  hidden: { y: "105%" },
  show: (i: number) => ({ y: "0%", transition: { duration: 0.95, ease: EASE, delay: 0.3 + i * 0.05 } }),
};

function Word({ className }: { className: string }) {
  return (
    <span className={`mata-title-copy ${className}`}>
      <span className="block overflow-hidden pb-[0.05em]">
        {Array.from("Tarefas").map((ch, i) => (
          <motion.span key={i} className="inline-block" variants={letter} custom={i} initial="hidden" animate="show">
            {ch}
          </motion.span>
        ))}
      </span>
    </span>
  );
}

function Title({ line }: { line: string }) {
  return (
    <h1 className="mata-title">
      <span className="sr-only">Tarefas {line}</span>
      <span aria-hidden className="mata-display mata-title-word relative block">
        <Word className="mata-title-cut" />
        <Word className="mata-title-solid" />
      </span>
      <motion.span
        aria-hidden
        className="mata-title-line"
        initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.8 }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={line}
            className="inline-flex items-center gap-[0.4em]"
            initial={{ y: "60%", opacity: 0, filter: "blur(6px)" }}
            animate={{ y: "0%", opacity: 1, filter: "blur(0px)", transition: { duration: 0.55, ease: EASE } }}
            exit={{ y: "-60%", opacity: 0, filter: "blur(6px)", transition: { duration: 0.28, ease: EASE } }}
          >
            <span className="mata-title-dot" />
            {line}
            <span className="mata-title-dot" />
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </h1>
  );
}

/* ---------- small parts ---------- */

/* A ring for the share of the day's tasks done. */
function Ring({ value, size = 44 }: { value: number; size?: number }) {
  const r = 18;
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden className="shrink-0 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgb(238 245 232 / 0.14)" strokeWidth="4" />
      <motion.circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="var(--mata-leaf)"
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        initial={{ strokeDashoffset: 1 }}
        animate={{ strokeDashoffset: 1 - value }}
        transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.2 }}
        style={{ filter: "drop-shadow(0 0 6px rgb(143 224 107 / 0.6))" }}
      />
    </svg>
  );
}

/* The week of the selected day: one row per day, with its count and a bar. */
function WeekCard({
  week,
  selected,
  today,
  stats,
  onPick,
  onShift,
}: {
  week: Date[];
  selected: string;
  today: string;
  stats: Map<string, { total: number; done: number }>;
  onPick: (key: string) => void;
  onShift: (days: number) => void;
}) {
  const first = week[0];
  const last = week[6];
  const range =
    first.getMonth() === last.getMonth()
      ? `${first.getDate()} – ${last.getDate()} de ${last.toLocaleDateString("pt-BR", { month: "long" })}`
      : `${first.getDate()} ${first.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")} – ${last.getDate()} ${last.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}`;

  return (
    <section aria-label="Semana" className="mata-glass mata-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mata-caps">Semana</p>
          <p className="mt-1 text-sm font-semibold">{range}</p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onShift(-7)} aria-label="Semana anterior" className="mata-btn mata-glass size-9 rounded-xl">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => onShift(7)} aria-label="Próxima semana" className="mata-btn mata-glass size-9 rounded-xl">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <ol className="mt-4 grid grid-cols-7 gap-1 lg:grid-cols-1 lg:gap-0.5">
        {week.map((d) => {
          const key = dateKey(d);
          const s = stats.get(key) ?? { total: 0, done: 0 };
          const isSel = key === selected;
          const label = capitalize(d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onPick(key)}
                aria-current={isSel ? "date" : undefined}
                aria-label={`${label}${key === today ? " (hoje)" : ""}: ${s.total} ${s.total === 1 ? "tarefa" : "tarefas"}, ${s.done} feitas`}
                className="mata-day relative w-full"
              >
                {isSel && (
                  <motion.span layoutId="mata-day" className="mata-day-light absolute inset-0" transition={{ type: "spring", stiffness: 420, damping: 36 }} />
                )}
                <span className="relative flex flex-col items-center gap-1 py-2 lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5">
                  <span className="text-[0.625rem] font-bold tracking-[0.12em] text-(--mata-faint) uppercase lg:w-8 lg:text-left">
                    {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3)}
                  </span>
                  <span className={`font-mono text-[0.9375rem] tabular-nums lg:w-6 ${key === today ? "text-(--mata-leaf)" : ""}`}>{d.getDate()}</span>
                  <span aria-hidden className="relative hidden h-1 flex-1 overflow-hidden rounded-full bg-white/10 lg:block">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-(--mata-leaf) transition-[width] duration-500 ease-(--mata-ease)"
                      style={{ width: s.total ? `${(s.done / s.total) * 100}%` : "0%" }}
                    />
                  </span>
                  <span className="hidden w-9 text-right font-mono text-xs text-(--mata-muted) tabular-nums lg:inline">
                    {s.total ? `${s.done}/${s.total}` : "—"}
                  </span>
                  <span aria-hidden className={`size-1 rounded-full lg:hidden ${s.total ? "bg-(--mata-leaf)" : "bg-transparent"}`} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------- the page ---------- */

export default function TasksPage({ user }: { user: { id: string; name: string } }) {
  const { data, toggleTask, addTask, updateTask, removeTask, restoreTask } = useOrbita(user.id);
  const now = useNow();
  const today = dateKey(now);

  const [selected, setSelected] = useState(today);
  const [direction, setDirection] = useState(0);
  const [filter, setFilter] = useState<Filter>("todas");
  const [scrolled, setScrolled] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ task: Task; index: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ambienceRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [targets] = useState(() => [ambienceRef, heroRef]);
  useParallax(targets);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const selectedDate = fromKey(selected);
  const offset = daysBetween(today, selected);
  const week = useMemo(() => weekOf(fromKey(selected)), [selected]);

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const t of data.tasks) {
      const s = m.get(t.date) ?? { total: 0, done: 0 };
      s.total++;
      if (t.done) s.done++;
      m.set(t.date, s);
    }
    return m;
  }, [data.tasks]);

  const dayTasks = useMemo(() => data.tasks.filter((t) => t.date === selected).sort(byTime), [data.tasks, selected]);
  const shown = dayTasks.filter((t) => (filter === "todas" ? true : filter === "feitas" ? t.done : !t.done));
  const doneCount = dayTasks.filter((t) => t.done).length;
  const total = dayTasks.length;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isLate = (t: Task) => !t.done && (offset < 0 || (offset === 0 && t.time !== null && minutesOf(t.time) < nowMinutes));
  const lateCount = dayTasks.filter(isLate).length;
  const next =
    offset === 0
      ? dayTasks.find((t) => !t.done && t.time && minutesOf(t.time) >= nowMinutes) ?? dayTasks.find((t) => !t.done)
      : dayTasks.find((t) => !t.done);
  const progress = total ? doneCount / total : 0;
  const dayLabel = capitalize(selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
  const shortLabel = capitalize(
    selectedDate.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, ""),
  );

  function pick(key: string) {
    if (key === selected) return;
    setDirection(key > selected ? 1 : -1);
    setSelected(key);
    playSound("swap");
  }

  // ← and → move between days, unless typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [role=menu]") || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowLeft") pick(shiftKey(selected, -1));
      if (e.key === "ArrowRight") pick(shiftKey(selected, 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function toggle(task: Task) {
    toggleTask(task.id);
    if (!task.done) {
      playSound("toggle-on");
      if (doneCount + 1 === total) window.setTimeout(() => playSound("success"), 260);
    } else {
      playSound("toggle-off");
    }
  }

  function remove(task: Task) {
    setRemoved({ task, index: data.tasks.findIndex((t) => t.id === task.id) });
    removeTask(task.id);
    playSound("close");
  }

  function undo() {
    if (!removed) return;
    restoreTask(removed.task, removed.index);
    setRemoved(null);
    playSound("open");
  }

  // The undo offer goes away on its own after a few seconds.
  useEffect(() => {
    if (!removed) return;
    const id = window.setTimeout(() => setRemoved(null), 6000);
    return () => window.clearTimeout(id);
  }, [removed]);

  function add(title: string, time: string | null) {
    const id = addTask(title, time, selected);
    setFreshId(id);
    if (filter === "feitas") setFilter("todas");
    playSound("sent");
  }

  // The new row glows for a moment.
  useEffect(() => {
    if (!freshId) return;
    const id = window.setTimeout(() => setFreshId(null), 1600);
    return () => window.clearTimeout(id);
  }, [freshId]);

  /*
   * The list as rows: pending tasks with a time under their period (Manhã,
   * Tarde, Noite), then those without a time, then the done ones; today, a
   * "now" line sits between the tasks before and after the present minute.
   */
  type Row = { kind: "head"; id: string; label: string; count: number } | { kind: "now"; id: string } | { kind: "task"; id: string; task: Task };
  const rows: Row[] = [];
  {
    const pendingTimed = shown.filter((t) => !t.done && t.time);
    const pendingFree = shown.filter((t) => !t.done && !t.time);
    const done = shown.filter((t) => t.done);
    let nowPlaced = offset !== 0 || pendingTimed.length === 0;
    for (const period of PERIODS) {
      const group = pendingTimed.filter((t) => periodOf(t.time!).id === period.id);
      if (!group.length) continue;
      rows.push({ kind: "head", id: `h-${period.id}`, label: period.label, count: group.length });
      for (const t of group) {
        if (!nowPlaced && minutesOf(t.time!) >= nowMinutes) {
          rows.push({ kind: "now", id: "now" });
          nowPlaced = true;
        }
        rows.push({ kind: "task", id: t.id, task: t });
      }
    }
    if (!nowPlaced) rows.push({ kind: "now", id: "now" });
    if (pendingFree.length) {
      rows.push({ kind: "head", id: "h-livre", label: "Sem horário", count: pendingFree.length });
      pendingFree.forEach((t) => rows.push({ kind: "task", id: t.id, task: t }));
    }
    if (done.length) {
      rows.push({ kind: "head", id: "h-feitas", label: "Feitas", count: done.length });
      done.forEach((t) => rows.push({ kind: "task", id: t.id, task: t }));
    }
  }

  function toList() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("lista")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), reduce ? 0 : 600);
  }

  // What the hero says under the title.
  const status =
    total === 0
      ? { label: "Dia livre", text: "Nenhuma tarefa por aqui. Uma clareira inteira para você." }
      : doneCount === total
        ? { label: "Tudo feito", text: "Pode respirar fundo." }
        : next
          ? { label: isLate(next) ? "Atrasada" : "A seguir", text: next.title, time: next.time }
          : { label: "A seguir", text: "Sem horário marcado." };

  return (
    <MotionConfig reducedMotion="user">
      <Ambience rootRef={ambienceRef} />

      <Header name={user.name} scrolled={scrolled} />

      <main className="relative">
        {/* ---------- hero: centred on the veil's edge ---------- */}
        <section aria-labelledby="mata-dia" className="relative flex min-h-[calc(100svh-4.5rem)] flex-col items-center justify-center px-(--mata-gutter) pb-28 text-center lg:min-h-[calc(100svh-5.5rem)]">
          <div ref={heroRef} className="mata-hero flex w-full flex-col items-center">
            {/* The date, between its arrows. */}
            <motion.div
              className="flex max-w-full items-center gap-3 sm:gap-6"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.35 }}
            >
              <button type="button" onClick={() => pick(shiftKey(selected, -1))} aria-label="Dia anterior" className="mata-btn mata-glass mata-glass-dark size-10 shrink-0 rounded-full">
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <p id="mata-dia" className="mata-eyebrow flex min-w-0 items-center gap-3" aria-live="polite">
                <span aria-hidden className="mata-rule hidden sm:block" />
                <span className="min-w-0 whitespace-nowrap">
                  {offset === 0 ? "Hoje · " : ""}
                  <span className="sm:hidden">{shortLabel}</span>
                  <span className="hidden sm:inline">{dayLabel}</span>
                </span>
                <span aria-hidden className="mata-rule mata-rule-r hidden sm:block" />
              </p>
              <button type="button" onClick={() => pick(shiftKey(selected, 1))} aria-label="Próximo dia" className="mata-btn mata-glass mata-glass-dark size-10 shrink-0 rounded-full">
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </motion.div>

            <div className="mt-6 sm:mt-8">
              <Title line={dayLine(offset, selectedDate)} />
            </div>

            {/* How the day stands: two glass pills. */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.95 }}
              className="mt-10 flex flex-wrap items-stretch justify-center gap-3 sm:mt-12"
            >
              <div className="mata-glass mata-glass-dark mata-pill flex items-center gap-3 py-2 pr-5 pl-2">
                <Ring value={progress} />
                <div className="text-left">
                  <p className="font-mono text-[1.0625rem] leading-none tabular-nums">
                    {doneCount}
                    <span className="text-(--mata-faint)">/{total}</span>
                  </p>
                  <p className="mt-1 text-xs text-(--mata-muted)">{total ? "feitas" : "tarefas"}</p>
                </div>
              </div>

              <div aria-live="polite" className="mata-glass mata-glass-dark mata-pill flex max-w-[min(100%,26rem)] items-center gap-4 px-5 py-2.5 text-left">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${selected}-${status.label}-${status.text}`}
                    className="min-w-0"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, ease: EASE }}
                  >
                    <p className="mata-caps" data-late={status.label === "Atrasada" ? "" : undefined}>
                      {status.label}
                      {"time" in status && status.time ? ` · ${status.time}` : ""}
                    </p>
                    <p className="mt-1 truncate text-[0.9375rem] font-semibold">{status.text}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>

            <AnimatePresence>
              {offset !== 0 && (
                <motion.button
                  type="button"
                  onClick={() => pick(today)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="mata-btn mt-5 h-10 rounded-full px-4 text-sm font-semibold text-(--mata-leaf)"
                >
                  Voltar para hoje
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            type="button"
            onClick={toList}
            initial={{ opacity: 0 }}
            animate={{ opacity: scrolled ? 0 : 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: scrolled ? 0 : 1.4 }}
            tabIndex={scrolled ? -1 : 0}
            className="mata-btn mata-glass mata-glass-dark mata-cue absolute bottom-[calc(var(--tabbar-space)+2rem)] left-1/2 h-11 -translate-x-1/2 rounded-full px-5 text-sm font-semibold"
          >
            Ver lista
            <ChevronDown className="mata-cue-icon size-4" aria-hidden />
          </motion.button>
        </section>

        {/* ---------- board ---------- */}
        <section
          id="lista"
          aria-label={`Tarefas de ${dayLabel}`}
          className="mx-auto grid w-full max-w-[74rem] scroll-mt-24 grid-cols-[minmax(0,1fr)] gap-4 px-(--mata-gutter) pb-24 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-5"
        >
          <motion.div
            className="mata-glass mata-panel order-2 flex flex-col p-4 sm:p-6 lg:order-none"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <div className="flex flex-wrap items-end justify-between gap-4 px-1">
              <div className="min-w-0">
                <p className="mata-caps">Lista do dia</p>
                <h2 className="mt-1.5 truncate font-display text-[clamp(1.375rem,2.2vw,1.75rem)] leading-tight font-bold tracking-[-0.02em]">{dayLabel}</h2>
              </div>
              {/* Filter: a glass segmented control with a sliding light. */}
              <div role="tablist" aria-label="Filtrar tarefas" className="grid w-full grid-cols-3 gap-1 rounded-full bg-black/25 p-1 ring-1 ring-white/10 sm:w-auto">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => {
                      if (f.id !== filter) playSound("tap");
                      setFilter(f.id);
                    }}
                    className={`relative h-9 rounded-full px-4 text-[0.8125rem] font-semibold transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-(--mata-leaf) ${filter === f.id ? "text-(--mata-ink)" : "text-(--mata-faint) hover:text-(--mata-muted)"}`}
                  >
                    {filter === f.id && (
                      <motion.span layoutId="mata-filter" className="mata-glass absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                    )}
                    <span className="relative">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div aria-hidden className="relative mx-1 mt-5 h-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-(--mata-leaf-deep) to-(--mata-leaf) shadow-[0_0_16px_rgb(143_224_107/0.6)]"
                initial={false}
                animate={{ width: `${progress * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 22 }}
              />
            </div>

            {/* ---------- add: first, so capturing takes one gesture ---------- */}
            <Composer
              now={now}
              inputRef={inputRef}
              dayName={offset === 0 ? "hoje" : offset === 1 ? "amanhã" : offset === -1 ? "ontem" : shortLabel.toLowerCase()}
              onAdd={add}
            />

            <div className="relative mt-3 min-h-[16rem]">
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={selected}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 36 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -36 }}
                  transition={{ duration: 0.26, ease: EASE }}
                >
                  <LayoutGroup>
                    <ul className="flex flex-col">
                      <AnimatePresence initial={true}>
                        {rows.map((row, i) =>
                          row.kind === "head" ? (
                            <GroupHead key={row.id} label={row.label} count={row.count} />
                          ) : row.kind === "now" ? (
                            <NowLine key="now" now={now} />
                          ) : (
                            <TaskRow
                              key={row.id}
                              task={row.task}
                              now={now}
                              isToday={offset === 0}
                              late={isLate(row.task)}
                              index={i}
                              isNew={row.id === freshId}
                              onToggle={() => toggle(row.task)}
                              onRename={(t) => updateTask(row.task.id, { title: t })}
                              onTime={(t) => updateTask(row.task.id, { time: t })}
                              onRemove={() => remove(row.task)}
                            />
                          ),
                        )}
                      </AnimatePresence>
                    </ul>
                  </LayoutGroup>

                  {shown.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
                      className="flex flex-col items-center px-6 py-14 text-center"
                    >
                      <span className="mata-glass grid size-14 place-items-center rounded-2xl">
                        {filter === "feitas" ? <Check className="size-6 text-(--mata-leaf)" aria-hidden /> : <Sprout className="size-6 text-(--mata-leaf)" aria-hidden />}
                      </span>
                      <p className="mt-4 font-semibold">{total === 0 ? "Nada plantado neste dia." : filter === "feitas" ? "Nenhuma feita ainda." : "Nada pendente."}</p>
                      <p className="mt-1 max-w-[30ch] text-sm text-(--mata-muted)">
                        {total === 0 ? "Escreva acima para criar a primeira. Um horário no texto, como “às 15h”, já vale." : filter === "feitas" ? "Marque uma tarefa para ela aparecer aqui." : "Tudo deste dia está feito."}
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ---------- aside: the week, and a tally ---------- */}
          <motion.aside
            className="order-1 flex flex-col gap-4 lg:order-none lg:gap-5"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
          >
            <WeekCard
              week={week}
              selected={selected}
              today={today}
              stats={stats}
              onPick={pick}
              onShift={(days) => pick(shiftKey(selected, days))}
            />

            <section aria-label="Resumo do dia" className="mata-glass mata-card hidden p-5 lg:block">
              <p className="mata-caps">Resumo</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Pendentes", value: total - doneCount, tone: "" },
                  { label: "Atrasadas", value: lateCount, tone: lateCount ? "text-(--mata-amber)" : "" },
                  { label: "Feitas", value: doneCount, tone: doneCount ? "text-(--mata-leaf)" : "" },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col-reverse rounded-2xl bg-black/20 px-1 py-3 ring-1 ring-white/8">
                    <dt className="mt-1.5 text-[0.6875rem] text-(--mata-muted)">{s.label}</dt>
                    <dd className={`mata-display text-[1.625rem] leading-none tabular-nums ${s.tone}`}>{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </motion.aside>
        </section>
      </main>

      <UndoToast title={removed?.task.title ?? null} onUndo={undo} onClose={() => setRemoved(null)} />
    </MotionConfig>
  );
}
