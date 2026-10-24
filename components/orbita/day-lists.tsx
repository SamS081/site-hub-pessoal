"use client";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { dateKey, minutesOf, weekOf, type Habit, type Note, type Task } from "@/lib/orbita";

const PERIODS = [
  { label: "Manhã", from: 0, to: 12 * 60 },
  { label: "Tarde", from: 12 * 60, to: 18 * 60 },
  { label: "Noite", from: 18 * 60, to: 24 * 60 },
];

function SectionHeading({ id, title, aside }: { id: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
      <h2 id={id} className="font-display text-[1.75rem] leading-none tracking-[-0.015em]">
        {title}
      </h2>
      {aside}
    </div>
  );
}

export function TaskList({
  tasks,
  now,
  onToggle,
  onRemove,
}: {
  tasks: Task[];
  now: Date;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const scheduled = tasks
    .filter((t) => t.time !== null)
    .sort((a, b) => minutesOf(a.time!) - minutesOf(b.time!));
  const groups = [
    ...PERIODS.map((p) => ({
      label: p.label,
      items: scheduled.filter((t) => minutesOf(t.time!) >= p.from && minutesOf(t.time!) < p.to),
    })),
    { label: "Sem horário", items: tasks.filter((t) => t.time === null) },
  ];

  return (
    <section aria-labelledby="tarefas-titulo" id="tarefas" className="scroll-mt-24">
      <SectionHeading
        id="tarefas-titulo"
        title="Tarefas de hoje"
        aside={
          <span className="font-mono text-sm text-muted-foreground tabular-nums">
            {tasks.filter((t) => t.done).length}/{tasks.length}
          </span>
        }
      />
      {tasks.length === 0 ? (
        <p className="py-10 text-muted-foreground">
          Seu dia está livre. Use <span className="text-foreground">Capturar</span> e leve a primeira tarefa para a ilha.
        </p>
      ) : (
        <div className="mt-2">
          {groups
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <div key={group.label} className="pt-6">
                <h3 className="atlas-label pb-2">{group.label}</h3>
                <ul>
                  {group.items.map((task) => {
                    const late = !task.done && task.time !== null && minutesOf(task.time) < nowMin;
                    return (
                      <li key={task.id} className="group/row flex items-center gap-4 border-b border-line/60 py-3 last:border-b-0">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-4">
                          <span className="relative grid size-5 shrink-0 place-items-center">
                            <input
                              type="checkbox"
                              checked={task.done}
                              onChange={() => onToggle(task.id)}
                              className="peer size-5 cursor-pointer appearance-none rounded-full border-[1.5px] border-foreground/50 transition-colors checked:border-done checked:bg-done hover:border-foreground"
                            />
                            <Check
                              className="pointer-events-none absolute size-3 text-background opacity-0 peer-checked:opacity-100"
                              strokeWidth={3}
                              aria-hidden
                            />
                          </span>
                          <span className={cn("w-12 shrink-0 font-mono text-sm tabular-nums", late ? "text-late" : "text-muted-foreground")}>
                            {task.time ?? "—"}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                            <span className={cn("transition-colors", task.done && "text-muted-foreground line-through decoration-foreground/30")}>
                              {task.title}
                            </span>
                            {late && <span className="text-xs text-late">atrasada</span>}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => onRemove(task.id)}
                          aria-label={`Remover “${task.title}”`}
                          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100"
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function ago(ts: number, now: Date) {
  const diff = (ts - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "agora há pouco";
  if (abs < 3600) return relative.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(diff / 3600), "hour");
  return relative.format(Math.round(diff / 86400), "day");
}

export function NotesPanel({ notes, now, onRemove }: { notes: Note[]; now: Date; onRemove: (id: string) => void }) {
  const recent = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  return (
    <section aria-labelledby="notas-titulo" id="notas" className="scroll-mt-24">
      <SectionHeading id="notas-titulo" title="Notas recentes" />
      {recent.length === 0 ? (
        <p className="py-8 text-muted-foreground">Nenhuma nota ainda. Troque a captura para Nota e escreva o que vier.</p>
      ) : (
        <ul>
          {recent.map((note) => (
            <li key={note.id} className="group/note relative border-b border-line/60 py-4 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3 pr-9">
                <h3 className="truncate font-medium">{note.title}</h3>
                <span className="shrink-0 text-xs text-muted-foreground">{ago(note.updatedAt, now)}</span>
              </div>
              {note.body && <p className="mt-1 line-clamp-2 max-w-[65ch] pr-9 text-sm leading-relaxed text-muted-foreground">{note.body}</p>}
              <span className="absolute top-[1.35rem] left-[-14px] size-1.5 rounded-full bg-nebula" aria-hidden />
              <button
                type="button"
                onClick={() => onRemove(note.id)}
                aria-label={`Apagar a nota “${note.title}”`}
                className="absolute top-3 right-0 grid size-8 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/note:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const WEEKDAY_INITIALS = ["S", "T", "Q", "Q", "S", "S", "D"];

export function HabitsPanel({
  habits,
  now,
  onToggle,
}: {
  habits: Habit[];
  now: Date;
  onToggle: (id: string, key: string) => void;
}) {
  const week = weekOf(now);
  const today = dateKey(now);

  return (
    <section aria-labelledby="habitos-titulo" id="habitos" className="scroll-mt-24">
      <SectionHeading id="habitos-titulo" title="Hábitos da semana" />
      {habits.length === 0 ? (
        <p className="py-8 text-muted-foreground">Nenhum hábito acompanhado ainda.</p>
      ) : (
        <table className="mt-3 w-full border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sr-only">Hábito</th>
              {week.map((d, i) => {
                const k = dateKey(d);
                return (
                  <th
                    key={k}
                    scope="col"
                    className={cn("w-8 pb-1 text-center font-mono text-[11px] font-normal", k === today ? "text-star" : "text-muted-foreground")}
                  >
                    <abbr title={d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric" })} className="no-underline">
                      {WEEKDAY_INITIALS[i]}
                    </abbr>
                  </th>
                );
              })}
              <th scope="col" className="sr-only">Total</th>
            </tr>
          </thead>
          <tbody>
            {habits.map((habit) => {
              const count = week.filter((d) => habit.doneOn.includes(dateKey(d))).length;
              return (
                <tr key={habit.id}>
                  <th scope="row" className="py-1.5 pr-3 text-left leading-snug font-normal">
                    {habit.name}
                  </th>
                  {week.map((d) => {
                    const k = dateKey(d);
                    const kept = habit.doneOn.includes(k);
                    const future = k > today;
                    return (
                      <td key={k} className="text-center">
                        <button
                          type="button"
                          disabled={future}
                          onClick={() => onToggle(habit.id, k)}
                          aria-pressed={kept}
                          aria-label={`${habit.name}, ${d.toLocaleDateString("pt-BR", { weekday: "long" })}`}
                          className={cn(
                            "mx-auto grid size-7 place-items-center rounded-full transition-colors disabled:cursor-not-allowed",
                            k === today && "ring-1 ring-star/50",
                          )}
                        >
                          <span
                            className={cn(
                              "size-2.5 rounded-full transition-[background-color,transform] duration-300",
                              kept ? "scale-125 bg-done" : future ? "bg-foreground/8" : "bg-foreground/20 hover:bg-foreground/40",
                            )}
                          />
                        </button>
                      </td>
                    );
                  })}
                  <td className="w-10 text-right font-mono text-xs text-muted-foreground tabular-nums">{count}/7</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
