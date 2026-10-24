import { dateKey, minutesOf, weekOf, type OrbitaData, type Task } from "@/lib/orbita";

/** Everything the home shows about the day, derived from the real store. */
export type DaySummary = {
  now: Date;
  /** Minutes since local midnight */
  nowMin: number;
  /** Share of the day already gone, 0..1 */
  dayShare: number;
  period: 0 | 1 | 2;
  tasksDone: number;
  tasksTotal: number;
  habitsMarked: number;
  habitsPossible: number;
  /** Per weekday (Mon..Sun): share of habits kept that day, null for days ahead */
  weekShares: (number | null)[];
  todayIndex: number;
  next: Task | null;
};

export const PERIODS = ["Manhã", "Tarde", "Noite"] as const;

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function clock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function summarize(data: OrbitaData, now: Date): DaySummary {
  const today = dateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hour = now.getHours();
  const period = hour >= 5 && hour < 12 ? 0 : hour >= 12 && hour < 18 ? 1 : 2;

  const todays = data.tasks.filter((t) => t.date === today);
  const next =
    todays
      .filter((t) => !t.done && t.time !== null && minutesOf(t.time) >= nowMin)
      .sort((a, b) => minutesOf(a.time!) - minutesOf(b.time!))[0] ?? null;

  const week = weekOf(now).map(dateKey);
  const habitsMarked = data.habits.reduce(
    (sum, h) => sum + h.doneOn.filter((k) => week.includes(k)).length,
    0,
  );
  const weekShares = week.map((k) =>
    k > today || data.habits.length === 0
      ? null
      : data.habits.filter((h) => h.doneOn.includes(k)).length / data.habits.length,
  );

  return {
    now,
    nowMin,
    dayShare: nowMin / 1440,
    period,
    tasksDone: todays.filter((t) => t.done).length,
    tasksTotal: todays.length,
    habitsMarked,
    habitsPossible: data.habits.length * 7,
    weekShares,
    todayIndex: week.indexOf(today),
    next,
  };
}

const LONG_DATE = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const SHORT_DATE = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "terça-feira, 21 de outubro" */
export function longDate(d: Date) {
  return LONG_DATE.format(d);
}

/** "ter, 21 out" (no trailing dots) */
export function shortDate(d: Date) {
  return SHORT_DATE.format(d).replace(/\./g, "");
}
