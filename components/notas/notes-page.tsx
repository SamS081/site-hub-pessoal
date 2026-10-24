"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion, type Transition } from "motion/react";
import { ChevronDown, LogOut, Search, Sun, SunDim, Trash2, Undo2, Volume2, VolumeX, X } from "lucide-react";

import { signOut } from "@/app/login/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CloudSky } from "@/components/notas/cloud-sky";
import { useOrbita, type Note } from "@/lib/orbita";
import { playSound, setSoundOn, useSoundOn } from "@/lib/sound";

/*
 * Notas ("Luz"): thoughts let go into the light, above the clouds at golden
 * hour (cloud-sky.tsx). The first screen is quiet and centred: a flock of
 * birds, the word "notas" in light, a line under it, and one pill of light
 * to write in. Writing is one gesture: the pill opens into a card in place;
 * "soltar" lets the note go (a light rises, birds take off) and it lands on
 * the board below. Notes are panes of warm frosted glass; one kept "near the
 * sun" (pinned) glows gold. A note opens into the editor in place, and a
 * deleted one dissolves upward like mist, with a moment to take it back.
 *
 * Motion, decided per mechanism: springs without bounce for anything that
 * changes shape (they start from where things are, so they can be
 * interrupted); short ease-out exits; the one flourish (the release) only on
 * creating a note; nothing animates when the keyboard asked for it.
 *
 * Its own sounds (lib/sound.ts "note-*": harp, birds, a far-off choir).
 * Data is the same local store as the home (lib/orbita.ts), per account.
 */

const SPRING: Transition = { type: "spring", bounce: 0, duration: 0.4 };
const SOFT: Transition = { type: "spring", bounce: 0, duration: 0.7 };
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type Filter = "todas" | "sol";
type Draft = { id?: string; title: string; body: string; pinned: boolean };

/* ---------- helpers ---------- */

/* Lowercase without accents; keeps the length of NFC text. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
function ago(ts: number, now: number) {
  const s = Math.round((ts - now) / 1000);
  const a = Math.abs(s);
  if (a < 60) return "agora";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86_400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 7 * 86_400) return rtf.format(Math.round(s / 86_400), "day");
  return new Date(ts).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
}

function byRecent(a: Note, b: Note) {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  return b.updatedAt - a.updatedAt;
}

/* A note from a draft: a missing title is the body's first line. */
function shapeDraft(d: Draft) {
  const title = d.title.trim();
  const body = d.body.trim();
  if (title || !body) return { title, body };
  const [first, ...rest] = body.split("\n");
  return { title: first.slice(0, 80), body: rest.join("\n").trim() };
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  if (!q) return <>{text}</>;
  const hay = fold(text);
  const parts: ReactNode[] = [];
  let from = 0;
  let at = hay.indexOf(q);
  while (at !== -1) {
    parts.push(text.slice(from, at));
    parts.push(<mark key={at}>{text.slice(at, at + q.length)}</mark>);
    from = at + q.length;
    at = hay.indexOf(q, from);
  }
  parts.push(text.slice(from));
  return <>{parts}</>;
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && !!el.closest("input, textarea, [contenteditable], [role=menu], [role=dialog]");

/* ---------- birds ---------- */

/* One bird: two arcs, the wings beating by scaling the shape vertically. */
function Bird({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 20 8" aria-hidden className="luz-bird" style={style}>
      <path d="M1 6 Q5.5 0.5 10 5 Q14.5 0.5 19 6" />
    </svg>
  );
}

/* A loose flock along an arc; each bird beats its own time. Decorative. */
const FLOCK_A = [
  [0, 30], [9, 18], [17, 26], [25, 10], [33, 20], [41, 4], [49, 16], [57, 8], [64, 22],
] as const;
const FLOCK_B = [
  [0, 0], [7, 14], [15, 22], [24, 28], [34, 32], [45, 30], [56, 26], [66, 18], [75, 10], [83, 4],
] as const;

function Flock({ points, className }: { points: readonly (readonly [number, number])[]; className: string }) {
  return (
    <div aria-hidden className={`luz-flock ${className}`}>
      {points.map(([x, y], i) => (
        <Bird
          key={i}
          style={{
            left: `${x}%`,
            top: `${y * 2.6}%`,
            animationDelay: `${(i * 137) % 900}ms, ${(i * 211) % 3000}ms`,
            width: `${10 + ((i * 37) % 10) * 0.7}px`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- header ---------- */

const SECTIONS = [
  { label: "hoje", href: "/" },
  { label: "tarefas", href: "/tarefas" },
  { label: "notas", href: "/notas", current: true },
  { label: "hábitos", href: "/habitos" },
];

function SoundItem() {
  const on = useSoundOn();
  return (
    <DropdownMenuItem
      closeOnClick={false}
      onClick={() => {
        if (on) {
          playSound("note-close");
          setSoundOn(false);
        } else {
          setSoundOn(true);
          playSound("note-pin");
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
    const sync = () => setScrolled(window.scrollY > 16);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, ease: EASE_OUT, delay: 0.2 }}
      data-scrolled={scrolled ? "" : undefined}
      className="luz-header"
    >
      <Link href="/" aria-label="Atol, voltar para Hoje" className="luz-brand">
        atol
      </Link>

      <nav aria-label="Seções" className="hidden md:block">
        <ul className="luz-nav">
          {SECTIONS.map((s) => (
            <li key={s.label}>
              <Link href={s.href} aria-current={s.current ? "page" : undefined} className="luz-nav-link">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <DropdownMenu onOpenChange={(open) => playSound(open ? "note-open" : "note-close")}>
        <DropdownMenuTrigger aria-label={`Menu da conta de ${name}`} className="luz-btn luz-account">
          <span className="luz-avatar">{name.trim().charAt(0).toLowerCase()}</span>
          <span className="hidden truncate sm:inline">{name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="luz-menu w-60">
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
    </motion.header>
  );
}

/* ---------- the release ---------- */

/*
 * Letting a note go: a light rises from where it was written and fades into
 * the sky, and a few birds take off from it. Only on creating a note (rare),
 * so this is where the page spends its delight. Transforms and opacity only.
 */
type Release = { id: number; x: number; y: number };

function ReleaseLayer({ releases }: { releases: Release[] }) {
  return (
    <div aria-hidden className="luz-release-layer">
      <AnimatePresence>
        {releases.map((r) => (
          <div key={r.id} className="luz-release" style={{ left: r.x, top: r.y }}>
            <motion.span
              className="luz-orb"
              initial={{ opacity: 0, transform: "translate(-50%, -50%) scale(0.6)" }}
              animate={{
                opacity: [0, 1, 1, 0],
                transform: [
                  "translate(-50%, -50%) scale(0.6)",
                  "translate(-50%, -80%) scale(1.15)",
                  "translate(-50%, -260%) scale(0.85)",
                  "translate(-50%, -620%) scale(0.4)",
                ],
              }}
              transition={{ duration: 1.5, ease: EASE_OUT, times: [0, 0.15, 0.55, 1] }}
            />
            {[-38, -20, -6, 10, 26, 42].map((angle, i) => (
              <motion.span
                key={i}
                className="luz-release-bird"
                initial={{ opacity: 0, transform: "translate(-50%, -50%) rotate(0deg)" }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  transform: [
                    "translate(-50%, -50%) rotate(0deg)",
                    `translate(calc(-50% + ${angle * 1.2}px), calc(-50% - 40px)) rotate(${angle / 4}deg)`,
                    `translate(calc(-50% + ${angle * 4}px), calc(-50% - 160px)) rotate(${angle / 3}deg)`,
                    `translate(calc(-50% + ${angle * 7}px), calc(-50% - 300px)) rotate(${angle / 2}deg)`,
                  ],
                }}
                transition={{ duration: 1.6, ease: EASE_OUT, delay: 0.25 + i * 0.05, times: [0, 0.15, 0.6, 1] }}
              >
                <Bird style={{ position: "static", animationDelay: `${i * 90}ms, 0ms` }} />
              </motion.span>
            ))}
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- composer ---------- */

/*
 * One pill of light. Pressing it (or N) opens it into a card right where it
 * is: the same surface changes shape (layout spring, no bounce), so the eye
 * never loses it. "Soltar" lets the note go.
 */
function Composer({
  open,
  instant,
  onOpen,
  onClose,
  onRelease,
}: {
  open: boolean;
  instant: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRelease: (d: Draft, from: DOMRect) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [shake, setShake] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const reduce = useReducedMotion();
  const layout: Transition = instant || reduce ? { duration: 0 } : SPRING;

  useEffect(() => {
    if (!open) return;
    if (instant) {
      titleRef.current?.focus({ preventScroll: true });
      return;
    }
    const id = window.setTimeout(() => titleRef.current?.focus({ preventScroll: true }), 120);
    return () => window.clearTimeout(id);
  }, [open, instant]);

  const reset = () => {
    setTitle("");
    setBody("");
    setPinned(false);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!title.trim() && !body.trim()) {
      setShake((n) => n + 1);
      playSound("nope");
      titleRef.current?.focus();
      return;
    }
    const rect = boxRef.current!.getBoundingClientRect();
    onRelease({ title, body, pinned }, rect);
    reset();
  };

  const cancel = () => {
    if (!title.trim() && !body.trim()) reset();
    onClose();
  };

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <motion.div
      ref={boxRef}
      layout
      transition={{ layout }}
      animate={shake ? { x: [0, -6, 6, -3, 0] } : undefined}
      key={`shake-${shake}`}
      className="luz-composer"
      data-open={open ? "" : undefined}
      style={{ borderRadius: open ? 28 : 999 }}
      onKeyDown={onKey}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {!open ? (
          <motion.button
            key="pill"
            type="button"
            onClick={onOpen}
            className="luz-pill"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
          >
            <span aria-hidden className="luz-pill-light" />
            <span className="flex-1 text-left">escreva algo leve…</span>
            <kbd className="luz-kbd">N</kbd>
          </motion.button>
        ) : (
          <motion.form
            key="card"
            onSubmit={submit}
            className="luz-compose-form"
            initial={instant || reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.12 } }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
          >
            <label htmlFor="luz-novo-titulo" className="sr-only">
              Título
            </label>
            <input
              ref={titleRef}
              id="luz-novo-titulo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  bodyRef.current?.focus();
                }
              }}
              placeholder="título"
              maxLength={120}
              autoComplete="off"
              className="luz-compose-title"
            />
            <label htmlFor="luz-novo-corpo" className="sr-only">
              Texto da nota
            </label>
            <textarea
              ref={bodyRef}
              id="luz-novo-corpo"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="o que está na cabeça…"
              rows={3}
              className="luz-compose-body"
            />
            <div className="luz-compose-foot">
              <button
                type="button"
                onClick={() => {
                  setPinned((p) => !p);
                  playSound(pinned ? "note-unpin" : "note-pin");
                }}
                aria-pressed={pinned}
                className="luz-btn luz-chip"
              >
                {pinned ? <Sun className="size-4" aria-hidden /> : <SunDim className="size-4" aria-hidden />}
                perto do sol
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={cancel} className="luz-btn luz-btn-quiet">
                  cancelar
                </button>
                <button type="submit" className="luz-btn luz-btn-light">
                  soltar
                  <span aria-hidden className="luz-btn-orb" />
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------- hero ---------- */

const fadeUp = {
  hidden: { opacity: 0, y: 12, filter: "blur(10px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 1.1, ease: EASE_OUT } },
};

function Hero({
  notes,
  composing,
  instant,
  onCompose,
  onCloseCompose,
  onRelease,
}: {
  notes: Note[];
  composing: boolean;
  instant: boolean;
  onCompose: () => void;
  onCloseCompose: () => void;
  onRelease: (d: Draft, from: DOMRect) => void;
}) {
  const near = notes.filter((n) => n.pinned).length;
  return (
    <section aria-labelledby="luz-titulo" className="luz-hero">
      <Flock points={FLOCK_A} className="luz-flock-a" />
      <Flock points={FLOCK_B} className="luz-flock-b" />

      <motion.div
        className="luz-hero-center"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.18, delayChildren: 0.5 } } }}
      >
        <motion.h1 variants={fadeUp} id="luz-titulo" className="luz-title">
          notas
        </motion.h1>
        <motion.p variants={fadeUp} className="luz-subtitle">
          pensamentos guardados na luz
        </motion.p>
        <motion.div variants={fadeUp} className="luz-compose-slot">
          <Composer open={composing} instant={instant} onOpen={onCompose} onClose={onCloseCompose} onRelease={onRelease} />
        </motion.div>
        <motion.p variants={fadeUp} className="luz-hero-meta">
          {notes.length} {notes.length === 1 ? "nota" : "notas"}
          {near > 0 && <> · {near} perto do sol</>}
        </motion.p>
      </motion.div>

      <motion.button
        type="button"
        onClick={() => document.getElementById("mural")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className="luz-btn luz-down"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.6 }}
      >
        ver notas
        <ChevronDown className="size-4" aria-hidden />
      </motion.button>
    </section>
  );
}

/* ---------- board ---------- */

function NoteCard({
  note,
  query,
  index,
  now,
  fresh,
  onOpen,
  onPin,
  onRemove,
}: {
  note: Note;
  query: string;
  index: number;
  now: number;
  fresh: boolean;
  onOpen: () => void;
  onPin: () => void;
  onRemove: () => void;
}) {
  return (
    <motion.li
      layout
      layoutId={`note-${note.id}`}
      // A note just let go arrives from above, out of the light.
      initial={fresh ? { opacity: 0, y: -40, scale: 0.96, filter: "blur(12px)" } : { opacity: 0, y: 16, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      // Deleted: it dissolves upward, like mist. Faster than it came.
      exit={{ opacity: 0, y: -14, scale: 1.02, filter: "blur(14px)", transition: { duration: 0.24, ease: EASE_OUT } }}
      transition={{ ...SOFT, delay: fresh ? 0.5 : Math.min(index, 8) * 0.05, layout: SPRING }}
      data-pinned={note.pinned ? "" : undefined}
      className="luz-card"
      style={{ borderRadius: 24 }}
    >
      <button type="button" onClick={onOpen} aria-label={`Abrir nota: ${note.title || "sem título"}`} className="luz-card-open" />
      <motion.div layout="position" className="luz-card-inner">
        <h3 className="luz-card-title">
          {note.pinned && <Sun className="luz-card-sun" aria-label="perto do sol" />}
          <Highlight text={note.title || "sem título"} query={query} />
        </h3>
        {note.body && (
          <p className="luz-card-body">
            <Highlight text={note.body} query={query} />
          </p>
        )}
        <div className="luz-card-foot">
          <time dateTime={new Date(note.updatedAt).toISOString()} className="luz-time">
            {ago(note.updatedAt, now)}
          </time>
          <div className="luz-card-actions">
            <button
              type="button"
              onClick={onPin}
              aria-pressed={!!note.pinned}
              aria-label={note.pinned ? `Afastar do sol: ${note.title}` : `Levar para perto do sol: ${note.title}`}
              title={note.pinned ? "afastar do sol" : "perto do sol"}
              className="luz-btn luz-icon"
            >
              {note.pinned ? <Sun className="size-4" aria-hidden /> : <SunDim className="size-4" aria-hidden />}
            </button>
            <button type="button" onClick={onRemove} aria-label={`Apagar: ${note.title}`} title="apagar" className="luz-btn luz-icon luz-icon-danger">
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.li>
  );
}

function Board({
  notes,
  now,
  fresh,
  searchRef,
  onOpen,
  onPin,
  onRemove,
}: {
  notes: Note[];
  now: number;
  fresh: string | null;
  searchRef: RefObject<HTMLInputElement | null>;
  onOpen: (n: Note) => void;
  onPin: (n: Note) => void;
  onRemove: (n: Note) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");

  const near = notes.filter((n) => n.pinned).length;
  const q = fold(query.trim());
  const shown = notes.filter((n) => (filter === "todas" || n.pinned) && (!q || fold(n.title).includes(q) || fold(n.body).includes(q)));

  return (
    <section id="mural" aria-labelledby="luz-mural" className="luz-board">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={SOFT}
        className="luz-board-head"
      >
        <h2 id="luz-mural" className="luz-board-title">
          suas notas
        </h2>

        <div className="luz-tools">
          <label className="luz-search">
            <Search className="size-4 shrink-0 opacity-60" strokeWidth={2.2} aria-hidden />
            <span className="sr-only">Buscar nas notas</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  e.currentTarget.blur();
                }
              }}
              placeholder="buscar"
              autoComplete="off"
              className="luz-search-input"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="Limpar busca"
                className="luz-btn luz-icon luz-icon-sm"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : (
              <kbd className="luz-kbd">/</kbd>
            )}
          </label>

          <div role="tablist" aria-label="Filtrar notas" className="luz-seg">
            {(
              [
                { id: "todas", label: "todas", n: notes.length },
                { id: "sol", label: "perto do sol", n: near },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className="luz-seg-opt"
              >
                {filter === f.id && <motion.span layoutId="luz-seg" className="luz-seg-light" transition={SPRING} />}
                <span className="relative">{f.label}</span>
                <span className="luz-seg-n relative">{f.n}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <ul className="luz-grid">
        <AnimatePresence mode="popLayout">
          {shown.map((n, i) => (
            <NoteCard
              key={n.id}
              note={n}
              query={query}
              index={i}
              now={now}
              fresh={n.id === fresh}
              onOpen={() => onOpen(n)}
              onPin={() => onPin(n)}
              onRemove={() => onRemove(n)}
            />
          ))}
        </AnimatePresence>
      </ul>

      <AnimatePresence>
        {shown.length === 0 && (
          <motion.div
            key={q ? "busca" : filter}
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={SOFT}
            className="luz-empty"
          >
            <span aria-hidden className="luz-empty-light" />
            <p className="luz-empty-title">{q ? "nada com esse nome." : notes.length === 0 ? "o céu está limpo." : "nenhuma nota perto do sol."}</p>
            <p className="luz-empty-text">
              {q
                ? "tente outra palavra ou limpe a busca."
                : notes.length === 0
                  ? "escreva algo lá em cima e solte."
                  : "toque no sol de uma nota para trazê-la para cá."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ---------- editor ---------- */

function Editor({
  draft: initial,
  onClose,
  onDelete,
}: {
  draft: Draft;
  onClose: (draft: Draft) => void;
  onDelete: (draft: Draft) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [pinned, setPinned] = useState(initial.pinned);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const draft = { id: initial.id, title, body, pinned };
  const close = () => onClose(draft);

  useEffect(() => {
    const id = window.setTimeout(() => bodyRef.current?.focus({ preventScroll: true }), 220);
    return () => window.clearTimeout(id);
  }, []);

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      close();
    }
  };

  const words = (title + " " + body).trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="luz-editor-wrap" onKeyDown={onKey}>
      {/* A modal task: the sky dims toward dusk around it. */}
      <motion.div
        aria-hidden
        className="luz-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        onClick={close}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Editar nota: ${initial.title}`}
        layoutId={`note-${initial.id}`}
        transition={SPRING}
        className="luz-editor"
        data-pinned={pinned ? "" : undefined}
        style={{ borderRadius: 32 }}
      >
        <motion.div
          className="flex min-h-0 flex-1 flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.12 } }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setPinned((p) => !p);
                playSound(pinned ? "note-unpin" : "note-pin");
              }}
              aria-pressed={pinned}
              className="luz-btn luz-chip"
            >
              {pinned ? <Sun className="size-4" aria-hidden /> : <SunDim className="size-4" aria-hidden />}
              perto do sol
            </button>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => onDelete(draft)} aria-label="Apagar nota" title="apagar" className="luz-btn luz-icon luz-icon-lg luz-icon-danger">
                <Trash2 className="size-[1.05rem]" aria-hidden />
              </button>
              <button type="button" onClick={close} aria-label="Fechar" title="fechar (esc)" className="luz-btn luz-icon luz-icon-lg">
                <X className="size-[1.05rem]" aria-hidden />
              </button>
            </div>
          </div>

          <label htmlFor="luz-editor-titulo" className="sr-only">
            Título
          </label>
          <textarea
            id="luz-editor-titulo"
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                bodyRef.current?.focus();
              }
            }}
            placeholder="título"
            rows={1}
            maxLength={120}
            className="luz-editor-title"
          />
          <label htmlFor="luz-editor-corpo" className="sr-only">
            Texto da nota
          </label>
          <textarea
            ref={bodyRef}
            id="luz-editor-corpo"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="o que está na cabeça…"
            className="luz-editor-body"
          />

          <div className="luz-editor-foot">
            <span className="luz-time">
              {words} {words === 1 ? "palavra" : "palavras"}
              <span className="hidden sm:inline"> · ctrl + enter guarda</span>
            </span>
            <button type="button" onClick={close} className="luz-btn luz-btn-light">
              pronto
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ---------- the page ---------- */

export default function NotesPage({ user }: { user: { id: string; name: string } }) {
  const { data, saveNote, removeNote, togglePinNote, restoreNote } = useOrbita(user.id);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [composing, setComposing] = useState(false);
  const [instant, setInstant] = useState(false);
  const [releases, setReleases] = useState<Release[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [onReady] = useState(() => () => setReady(true));
  const [undo, setUndo] = useState<{ note: Note; index: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const searchRef = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const notes = useMemo(() => [...data.notes].sort(byRecent), [data.notes]);

  const compose = useCallback((byKey = false) => {
    setInstant(byKey);
    setComposing(true);
    if (!byKey) playSound("note-open");
  }, []);

  function release(d: Draft, from: DOMRect) {
    const shaped = shapeDraft(d);
    const id = saveNote({ ...shaped, pinned: d.pinned });
    setFresh(id);
    setComposing(false);
    setInstant(false);
    playSound("note-create");
    if (!reduce) {
      const r = { id: Date.now(), x: from.left + from.width / 2, y: from.top + from.height / 2 };
      setReleases((list) => [...list, r]);
      window.setTimeout(() => setReleases((list) => list.filter((x) => x.id !== r.id)), 2200);
    }
  }

  const openNote = useCallback((n: Note) => {
    opener.current = document.activeElement as HTMLElement | null;
    setEditing({ id: n.id, title: n.title, body: n.body, pinned: !!n.pinned });
    playSound("note-open");
  }, []);

  const remove = useCallback(
    (n: Note) => {
      const index = data.notes.findIndex((x) => x.id === n.id);
      removeNote(n.id);
      setUndo({ note: n, index });
      playSound("note-delete");
    },
    [data.notes, removeNote],
  );

  function restore() {
    if (!undo) return;
    restoreNote(undo.note, undo.index);
    setUndo(null);
    playSound("note-undo");
  }

  // The undo offer lasts six seconds, and waits while the tab is hidden.
  useEffect(() => {
    if (!undo) return;
    let left = 6000;
    let started = Date.now();
    let id = window.setTimeout(() => setUndo(null), left);
    const onVis = () => {
      if (document.hidden) {
        window.clearTimeout(id);
        left -= Date.now() - started;
      } else {
        started = Date.now();
        id = window.setTimeout(() => setUndo(null), left);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [undo]);

  function pin(n: Note) {
    togglePinNote(n.id);
    playSound(n.pinned ? "note-unpin" : "note-pin");
  }

  function closeEditor(d: Draft) {
    const before = data.notes.find((n) => n.id === d.id);
    const title = d.title.trim();
    const body = d.body.trim();
    if (!before) {
      playSound("note-close");
    } else if (!title && !body) {
      setEditing(null);
      remove(before);
      return;
    } else {
      const changed = before.title !== title || before.body !== body;
      if (changed) saveNote({ id: d.id, title, body });
      if (!!before.pinned !== d.pinned) togglePinNote(before.id);
      playSound(changed ? "note-save" : "note-close");
    }
    setEditing(null);
    const back = opener.current;
    window.setTimeout(() => back?.isConnected && back.focus({ preventScroll: true }), 300);
  }

  function deleteFromEditor(d: Draft) {
    const n = data.notes.find((x) => x.id === d.id);
    setEditing(null);
    if (n) remove(n);
  }

  // N: write. /: search. Ctrl+Z: undo the last delete. Nothing animates for keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || isTyping(e.target) || e.altKey) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && undo) {
        e.preventDefault();
        restore();
        return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        window.scrollTo({ top: 0 });
        compose(true);
      } else if (e.key === "/") {
        e.preventDefault();
        document.getElementById("mural")?.scrollIntoView({ block: "start" });
        searchRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // While the editor is open the page under it stays put.
  useEffect(() => {
    if (!editing) return;
    const root = document.documentElement;
    const gap = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    root.style.paddingRight = `${gap}px`;
    return () => {
      root.style.overflow = "";
      root.style.paddingRight = "";
    };
  }, [editing]);

  return (
    <MotionConfig reducedMotion="user">
      <div aria-hidden data-ready={ready} className="luz-ground">
        <CloudSky onReady={onReady} />
      </div>

      <LayoutGroup>
        <Header name={user.name} />
        <main>
          <Hero
            notes={notes}
            composing={composing}
            instant={instant}
            onCompose={() => compose()}
            onCloseCompose={() => {
              setComposing(false);
              setInstant(false);
            }}
            onRelease={release}
          />
          <Board notes={notes} now={now} fresh={fresh} searchRef={searchRef} onOpen={openNote} onPin={pin} onRemove={remove} />
        </main>

        <AnimatePresence>
          {editing && <Editor key={editing.id} draft={editing} onClose={closeEditor} onDelete={deleteFromEditor} />}
        </AnimatePresence>
      </LayoutGroup>

      <ReleaseLayer releases={releases} />

      <div aria-live="polite" className="luz-toast-slot">
        <AnimatePresence>
          {undo && (
            <motion.div
              key={undo.note.id}
              initial={{ opacity: 0, y: 16, scale: 0.96, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 16, scale: 0.97, filter: "blur(6px)", transition: { duration: 0.2, ease: EASE_OUT } }}
              transition={SPRING}
              className="luz-toast"
            >
              <span className="min-w-0 truncate">
                a nota se desfez<span className="hidden sm:inline">: {undo.note.title || "sem título"}</span>
              </span>
              <button type="button" onClick={restore} className="luz-btn luz-btn-light luz-btn-sm">
                <Undo2 className="size-4" aria-hidden />
                desfazer
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
