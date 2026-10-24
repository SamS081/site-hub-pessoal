"use client";

import { type RefObject, useState } from "react";
import { ArrowUpRight, Clock, CornerDownLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { minutesOf, type Task } from "@/lib/orbita";

export function greeting(h: number) {
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function untilText(minutes: number) {
  if (minutes < 1) return "agora";
  if (minutes < 60) return `em ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `em ${h} h ${m} min` : `em ${h} h`;
}

type Kind = "tarefa" | "nota";

/** Date and greeting: the chart's cartouche. */
export function DayIdentity({ now, name }: { now: Date; name: string }) {
  const weekday = now.toLocaleDateString("pt-BR", { weekday: "long" });
  const month = now.toLocaleDateString("pt-BR", { month: "long" });
  return (
    <div>
      <h1 className="flex items-end gap-4">
        <span className="font-display text-[clamp(3.75rem,9vw,6rem)] leading-[0.82] tracking-[-0.03em] tabular-nums">
          {now.getDate()}
        </span>
        <span className="pb-1 text-lg leading-tight text-muted-foreground">
          <span className="text-foreground">{weekday[0].toUpperCase() + weekday.slice(1)}</span>
          <br />
          de {month} de {now.getFullYear()}
        </span>
      </h1>
      <p className="mt-5 text-2xl tracking-[-0.01em] text-balance">
        {greeting(now.getHours())}, {name}.
      </p>
    </div>
  );
}

export function DayHeader({
  now,
  tasks,
  inputRef,
  onAddTask,
  onAddNote,
}: {
  now: Date;
  tasks: Task[];
  inputRef: RefObject<HTMLInputElement | null>;
  onAddTask: (title: string, time: string | null) => void;
  onAddNote: (text: string) => void;
}) {
  const [kind, setKind] = useState<Kind>("tarefa");
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const done = tasks.filter((t) => t.done).length;
  const next = tasks
    .filter((t): t is Task & { time: string } => !t.done && t.time !== null && minutesOf(t.time) >= nowMin)
    .sort((a, b) => minutesOf(a.time) - minutesOf(b.time))[0];
  const late = tasks.filter((t) => !t.done && t.time !== null && minutesOf(t.time) < nowMin).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (kind === "tarefa") onAddTask(value, time || null);
    else onAddNote(value);
    setText("");
    setTime("");
    setSaved(kind === "tarefa" ? "Tarefa adicionada ao dia." : "Nota guardada.");
    window.setTimeout(() => setSaved(null), 2400);
  }

  return (
    <div className="flex flex-col gap-8">

      <dl className="grid gap-4 border-y border-line py-5">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted-foreground">Feitas hoje</dt>
          <dd className="font-mono text-sm tabular-nums">
            <span className="text-foreground">{done}</span>
            <span className="text-muted-foreground"> de {tasks.length}</span>
          </dd>
        </div>
        <div className="flex gap-1" aria-hidden>
          {tasks.map((t) => (
            <span
              key={t.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-500",
                t.done ? "bg-done" : "bg-foreground/12",
              )}
            />
          ))}
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-sm text-muted-foreground">A seguir</dt>
          <dd className="text-right text-sm">
            {next ? (
              <>
                <span className="font-medium">{next.title}</span>
                <span className="mt-0.5 block font-mono text-xs text-star tabular-nums">
                  {next.time} · {untilText(minutesOf(next.time) - nowMin)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Nada agendado até o fim do dia</span>
            )}
          </dd>
        </div>
        {late > 0 && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Pendentes de horas passadas</dt>
            <dd className="font-mono text-sm text-late tabular-nums">{late}</dd>
          </div>
        )}
      </dl>

      <form onSubmit={submit} className="flex flex-col gap-3"aria-label="Captura rápida">
        <div className="flex items-center justify-between">
          <div role="radiogroup" aria-label="Tipo" className="inline-flex rounded-full border border-line p-0.5">
            {(["tarefa", "nota"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className="rounded-full px-3.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground aria-checked:bg-foreground aria-checked:text-background"
              >
                {k === "tarefa" ? "Tarefa" : "Nota"}
              </button>
            ))}
          </div>
          <p role="status" className="text-xs text-done">{saved}</p>
        </div>

        <div className="flex items-stretch gap-2 rounded-xl border border-input bg-raised p-1.5 transition-colors focus-within:border-star/60">
          <label htmlFor="capture" className="sr-only">
            {kind === "tarefa" ? "Nova tarefa" : "Nova nota"}
          </label>
          <input
            id="capture"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === "tarefa" ? "O que entra hoje?" : "Uma ideia, uma lista…"}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent px-2.5 text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {kind === "tarefa" && (
            <label className="flex items-center gap-1.5 rounded-lg px-2 text-muted-foreground focus-within:text-foreground">
              <Clock className="size-4" aria-hidden />
              <span className="sr-only">Horário (opcional)</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-[4.25rem] bg-transparent font-mono text-sm tabular-nums outline-none [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </label>
          )}
          <Button type="submit" size="icon-lg" className="rounded-lg" disabled={!text.trim()} aria-label="Adicionar">
            <CornerDownLeft />
          </Button>
        </div>
        <a href="#tarefas" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Ver o dia em lista
          <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
      </form>
    </div>
  );
}
