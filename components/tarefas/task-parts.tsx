"use client";

import { useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Clock, Plus, Sparkles, Trash2, X } from "lucide-react";

import { detectTime, inAnHour, PRESETS, relative } from "@/components/tarefas/time";
import { TimePicker } from "@/components/tarefas/time-picker";
import { minutesOf, type Task } from "@/lib/orbita";
import { playSound } from "@/lib/sound";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- composer ---------- */

/*
 * Creating a task. One line to type in; a time written in the text ("às
 * 15h", "9:30", "meio-dia") is picked up as you type and shown on the time
 * chip, marked as read from the text, and taken out of the title on save.
 * Choosing a time by hand (the chip's picker or a quick preset) wins over
 * the text. The quick row unfolds while the field has focus or content.
 * Enter adds, Esc clears.
 */
export function Composer({
  now,
  dayName,
  inputRef,
  onAdd,
}: {
  now: Date;
  /** "hoje", "amanhã", "sábado, 24": where the task will go. */
  dayName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onAdd: (title: string, time: string | null) => void;
}) {
  const [text, setText] = useState("");
  // undefined: not chosen by hand (follow the text); null: chosen "no time".
  const [manual, setManual] = useState<string | null | undefined>(undefined);
  const [shake, setShake] = useState(0);
  const [focused, setFocused] = useState(false);

  const detected = manual === undefined ? detectTime(text) : null;
  const time = manual !== undefined ? manual : (detected?.time ?? null);
  const open = focused || text.length > 0 || manual !== undefined;
  const soon = inAnHour(now);
  const quick = [{ label: "Em 1 h", time: soon }, ...PRESETS];

  function reset() {
    setText("");
    setManual(undefined);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const title = (detected && detected.title ? detected.title : text).trim();
    if (!title) {
      setShake((n) => n + 1);
      playSound("nope");
      inputRef.current?.focus();
      return;
    }
    onAdd(title.slice(0, 120), time);
    reset();
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && (text || manual !== undefined)) {
      e.preventDefault();
      reset();
    }
  }

  const pickQuick = (t: string | null) => {
    playSound("tap");
    setManual(manual === t ? undefined : t);
    inputRef.current?.focus();
  };

  return (
    <motion.form
      key={shake}
      onSubmit={submit}
      animate={shake ? { x: [0, -6, 6, -4, 0] } : undefined}
      transition={{ duration: 0.36 }}
      data-open={open ? "" : undefined}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
      className="mata-glass mata-composer mt-5"
    >
      <div className="flex items-center gap-2 p-2 pl-3.5 sm:pl-4">
        <Plus className="mata-composer-plus size-4 shrink-0" aria-hidden />
        <label htmlFor="mata-nova" className="sr-only">
          Nova tarefa
        </label>
        <input
          ref={inputRef}
          id="mata-nova"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Nova tarefa…"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={140}
          className="mata-input h-11 min-w-0 flex-1 text-[0.9375rem]"
        />

        <TimePicker
          value={time}
          onChange={(t) => setManual(t)}
          now={now}
          label={time ? `Horário: ${time}. Mudar` : "Escolher horário"}
          className="mata-time-chip shrink-0"
        >
          <Clock className="size-3.5" aria-hidden />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={time ?? "none"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE }}
              className={time ? "font-mono tabular-nums" : "hidden sm:inline"}
            >
              {time ?? "Horário"}
            </motion.span>
          </AnimatePresence>
          {detected && <Sparkles className="size-3 text-(--mata-leaf)" aria-label="lido do texto" />}
        </TimePicker>

        <button type="submit" className="mata-btn mata-btn-leaf h-11 shrink-0 rounded-[0.95rem] px-3.5 text-sm sm:px-4">
          <span className="hidden sm:inline">Adicionar</span>
          <span className="sr-only sm:hidden">Adicionar tarefa</span>
          <ArrowRight className="size-4 sm:hidden" strokeWidth={2.6} aria-hidden />
        </button>
      </div>

      {/* The quick row: presets, and what will happen. */}
      <div className="mata-composer-more">
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-1.5 border-t border-(--mata-line) px-3 pt-2.5 pb-3 sm:px-4">
            <button type="button" tabIndex={open ? 0 : -1} onClick={() => pickQuick(null)} aria-pressed={manual === null} className="mata-preset">
              Sem horário
            </button>
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                tabIndex={open ? 0 : -1}
                onClick={() => pickQuick(q.time)}
                aria-pressed={time === q.time && manual !== undefined}
                className="mata-preset"
              >
                {q.label} <span className="font-mono text-(--mata-faint)">{q.time}</span>
              </button>
            ))}
            <p aria-live="polite" className="ml-auto hidden pl-2 text-xs text-(--mata-faint) md:block">
              {detected ? (
                <>
                  <span className="text-(--mata-leaf)">“{detected.text}”</span> vira o horário
                </>
              ) : (
                <>
                  Para {dayName} · <kbd className="mata-kbd">Enter</kbd> adiciona
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </motion.form>
  );
}

/* ---------- a task row ---------- */

/*
 * One task: a time column (the time large, and how far it is from now, in
 * amber once it has passed), the check, the title (click to rename) and the
 * delete button. The time column is a button that opens the picker, so a
 * task without a time can get one in a click.
 */
export function TaskRow({
  task,
  now,
  isToday,
  late,
  index,
  isNew,
  onToggle,
  onRename,
  onTime,
  onRemove,
}: {
  task: Task;
  now: Date;
  isToday: boolean;
  late: boolean;
  index: number;
  isNew: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
  onTime: (time: string | null) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diff = task.time ? minutesOf(task.time) - nowMinutes : null;
  const rel = task.done ? "feita" : isToday && diff !== null ? relative(diff) : late ? "atrasada" : null;
  const tone = task.done ? "done" : late ? "late" : diff !== null && isToday && diff >= 0 && diff <= 60 ? "soon" : undefined;

  function save() {
    const t = draft.trim();
    setEditing(false);
    if (t && t !== task.title) {
      onRename(t.slice(0, 140));
      playSound("tap");
    } else setDraft(task.title);
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: EASE, delay: Math.min(index, 8) * 0.035 } }}
      exit={{ opacity: 0, x: -28, scale: 0.97, transition: { duration: 0.25, ease: EASE } }}
      transition={{ layout: { type: "spring", stiffness: 380, damping: 36 } }}
      data-done={task.done ? "" : undefined}
      data-new={isNew ? "" : undefined}
      className="mata-task grid grid-cols-[3.75rem_auto_minmax(0,1fr)_auto] items-center gap-3 py-3 pr-2 pl-1.5 sm:grid-cols-[4.5rem_auto_minmax(0,1fr)_auto] sm:pl-2"
    >
      <TimePicker
        value={task.time}
        onChange={onTime}
        now={now}
        align="start"
        label={task.time ? `Horário de ${task.title}: ${task.time}. Mudar` : `Dar um horário a ${task.title}`}
        className="mata-time-cell"
      >
        {task.time ? (
          <>
            <span className="mata-time-main">{task.time}</span>
            {rel && (
              <span className="mata-time-rel" data-tone={tone}>
                {rel}
              </span>
            )}
          </>
        ) : (
          <span className="mata-time-empty">
            <Clock className="size-3.5" aria-hidden />
            <span className="mata-time-empty-label">hora</span>
          </span>
        )}
      </TimePicker>

      <button type="button" role="checkbox" aria-checked={task.done} aria-label={task.done ? `Desmarcar: ${task.title}` : `Concluir: ${task.title}`} onClick={onToggle} className="mata-check">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: task.done ? 1 : 0, opacity: task.done ? 1 : 0 }}
            transition={{ duration: task.done ? 0.38 : 0.18, ease: EASE }}
          />
        </svg>
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          aria-label="Renomear tarefa"
          maxLength={140}
          className="mata-rename"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(task.title);
            setEditing(true);
          }}
          title="Clique para renomear"
          className="mata-task-name min-w-0 text-left text-[0.9375rem] leading-snug [overflow-wrap:anywhere]"
        >
          <span className="mata-task-title">{task.title}</span>
          <span className="sr-only">, renomear</span>
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Apagar: ${task.title}`}
        className="mata-remove grid size-8 shrink-0 place-items-center rounded-full text-(--mata-faint) outline-none focus-visible:ring-2 focus-visible:ring-(--mata-leaf)"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </motion.li>
  );
}

/* ---------- list furniture ---------- */

export function GroupHead({ label, count }: { label: string; count: number }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE, layout: { type: "spring", stiffness: 380, damping: 36 } }}
      className="mata-group"
      role="presentation"
    >
      <span>{label}</span>
      <span className="font-mono text-(--mata-faint)">{count}</span>
    </motion.li>
  );
}

/* The present moment, drawn between the tasks that come before and after it. */
export function NowLine({ now }: { now: Date }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scaleX: 0.6 }}
      animate={{ opacity: 1, scaleX: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: EASE, layout: { type: "spring", stiffness: 380, damping: 36 } }}
      className="mata-now"
      aria-label={`Agora, ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`}
    >
      <span className="mata-now-label">
        Agora <span className="font-mono">{`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`}</span>
      </span>
      <span aria-hidden className="mata-now-dot" />
      <span aria-hidden className="mata-now-line" />
    </motion.li>
  );
}

/* After a delete: the way back, for a few seconds. */
export function UndoToast({ title, onUndo, onClose }: { title: string | null; onUndo: () => void; onClose: () => void }) {
  return (
    <AnimatePresence>
      {title !== null && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="mata-glass mata-glass-dark mata-toast fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 py-2 pr-2 pl-4"
        >
          <p className="max-w-[16rem] truncate text-sm">
            <span className="text-(--mata-muted)">Apagada:</span> {title}
          </p>
          <button type="button" onClick={onUndo} className="mata-btn h-9 rounded-full px-3.5 text-sm font-semibold text-(--mata-leaf)">
            Desfazer
          </button>
          <button type="button" onClick={onClose} aria-label="Fechar aviso" className="mata-btn size-9 rounded-full text-(--mata-faint)">
            <X className="size-4" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
