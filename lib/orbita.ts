"use client";

import { useCallback, useEffect, useState } from "react";

import { useCloudSync } from "@/lib/sync";

export type Task = {
  id: string;
  title: string;
  /** "HH:MM" in local time, or null for an unscheduled task */
  time: string | null;
  /** "YYYY-MM-DD" in local time */
  date: string;
  done: boolean;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  /** Pinned notes sit first on the Notas page */
  pinned?: boolean;
};

export type Habit = {
  id: string;
  name: string;
  /** Local date keys on which the habit was kept */
  doneOn: string[];
};

export type OrbitaData = {
  tasks: Task[];
  notes: Note[];
  habits: Habit[];
  /** True while the store still holds the bundled example content */
  sample: boolean;
};

/*
 * Each account's day lives on the server (lib/sync.ts) and is cached in this
 * browser, so pages open at once and keep working offline.
 */
const storageKey = (userId: string) => `orbita:v1:${userId}`;

export function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Monday-first week containing `today`. */
export function weekOf(today: Date) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function sampleData(today: Date): OrbitaData {
  const date = dateKey(today);
  const week = weekOf(today).map(dateKey);
  const pastDays = week.filter((k) => k < date);
  const pick = (pattern: number[]) =>
    pastDays.filter((_, i) => pattern[i % pattern.length] === 1);
  const hour = 60 * 60 * 1000;

  return {
    sample: true,
    tasks: [
      { id: uid(), title: "Correr 5 km no parque", time: "07:00", date, done: true },
      { id: uid(), title: "Revisar contrato do apartamento", time: "09:30", date, done: true },
      { id: uid(), title: "Responder e-mails da faculdade", time: "11:00", date, done: true },
      { id: uid(), title: "Almoço com a Bia", time: "13:00", date, done: false },
      { id: uid(), title: "Ligar para o dentista", time: "15:30", date, done: false },
      { id: uid(), title: "Mercado: frutas, café e pão", time: "18:30", date, done: false },
      { id: uid(), title: "Aula de inglês", time: "20:00", date, done: false },
      { id: uid(), title: "Ler 20 páginas", time: "22:30", date, done: false },
      { id: uid(), title: "Pagar a conta de luz", time: null, date, done: false },
    ],
    notes: [
      {
        id: uid(),
        title: "Viagem a Paraty",
        body: "Pousada perto do centro histórico. Ver passeio de escuna e a cachoeira do Tobogã. Levar repelente.",
        updatedAt: today.getTime() - 2 * hour,
      },
      {
        id: uid(),
        title: "Livros para novembro",
        body: "Torto Arado, A hora da estrela, O avesso da pele. Procurar edição de bolso.",
        updatedAt: today.getTime() - 26 * hour,
      },
      {
        id: uid(),
        title: "Pão de queijo da vó",
        body: "500 g de polvilho azedo, 250 ml de leite, 100 ml de óleo, 2 ovos, queijo meia-cura a gosto. Forno a 200 °C.",
        updatedAt: today.getTime() - 4 * 24 * hour,
      },
    ],
    habits: [
      { id: uid(), name: "Beber 2 L de água", doneOn: pick([1, 1, 0, 1, 1, 1]) },
      { id: uid(), name: "Meditar 10 min", doneOn: pick([1, 0, 1, 1, 0, 1]) },
      { id: uid(), name: "Dormir antes da meia-noite", doneOn: pick([0, 1, 1, 0, 1, 0]) },
      { id: uid(), name: "Café sem celular", doneOn: pick([1, 1, 1, 0, 1, 1]) },
    ],
  };
}

/*
 * True for data with nothing of the person's own in it: empty, or only the
 * example content (matched by title, as its ids are random). Such data gives
 * way to the account's real data on a browser's first sync.
 */
function isSample(d: OrbitaData) {
  const s = sampleData(new Date());
  const titles = new Set([...s.tasks.map((t) => t.title), ...s.notes.map((n) => n.title), ...s.habits.map((h) => h.name)]);
  return (
    d.tasks.every((t) => titles.has(t.title)) &&
    d.notes.every((n) => titles.has(n.title)) &&
    d.habits.every((h) => titles.has(h.name))
  );
}

const EMPTY: OrbitaData = { tasks: [], notes: [], habits: [], sample: false };

/** This browser's copy, or null when it has none yet. */
function load(userId: string): OrbitaData | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (raw) return JSON.parse(raw) as OrbitaData;
  } catch {
    // Storage blocked or corrupt: the server's copy fills in.
  }
  return null;
}

/**
 * The account's tasks, notes and habits: read from this browser's copy,
 * synced with the server in the background. Must render client-only (it
 * reads localStorage during the first render).
 */
export function useOrbita(userId: string) {
  // With no copy here yet, start empty until the server answers, rather than
  // flashing the example content over the person's real day.
  const [cached] = useState(() => load(userId));
  const [data, setData] = useState<OrbitaData>(() => cached ?? EMPTY);
  useCloudSync(userId, data, setData, {
    fresh: cached === null,
    makeSample: () => sampleData(new Date()),
    isSample,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(data));
    } catch {
      // Private mode or quota: the session keeps working in memory.
    }
  }, [userId, data]);

  const toggleTask = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  }, []);

  /** `date` is a "YYYY-MM-DD" key; today when left out. Returns the new task's id. */
  const addTask = useCallback((title: string, time: string | null, date?: string) => {
    const id = uid();
    setData((d) => ({
      ...d,
      tasks: [...d.tasks, { id, title, time, date: date ?? dateKey(new Date()), done: false }],
    }));
    return id;
  }, []);

  /** Changes a task's title or time. */
  const updateTask = useCallback((id: string, patch: Partial<Pick<Task, "title" | "time">>) => {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  const removeTask = useCallback((id: string) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  }, []);

  /** Puts a removed task back where it was (undo). */
  const restoreTask = useCallback((task: Task, index: number) => {
    setData((d) => {
      if (d.tasks.some((t) => t.id === task.id)) return d;
      const tasks = [...d.tasks];
      tasks.splice(Math.min(index, tasks.length), 0, task);
      return { ...d, tasks };
    });
  }, []);

  const addNote = useCallback((text: string) => {
    const [first, ...rest] = text.split(/(?<=[.!?])\s+/);
    setData((d) => ({
      ...d,
      notes: [
        { id: uid(), title: first.slice(0, 80), body: rest.join(" "), updatedAt: Date.now() },
        ...d.notes,
      ],
    }));
  }, []);

  const removeNote = useCallback((id: string) => {
    setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
  }, []);

  /** Creates the note when `id` is left out; returns its id. */
  const saveNote = useCallback((note: { id?: string; title: string; body: string; pinned?: boolean }) => {
    const id = note.id ?? uid();
    setData((d) => {
      const fields = { title: note.title, body: note.body, updatedAt: Date.now() };
      if (note.id && d.notes.some((n) => n.id === note.id)) {
        return { ...d, notes: d.notes.map((n) => (n.id === note.id ? { ...n, ...fields } : n)) };
      }
      return { ...d, notes: [{ id, ...fields, pinned: note.pinned ?? false }, ...d.notes] };
    });
    return id;
  }, []);

  const togglePinNote = useCallback((id: string) => {
    setData((d) => ({ ...d, notes: d.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)) }));
  }, []);

  /** Puts a removed note back where it was (undo). */
  const restoreNote = useCallback((note: Note, index: number) => {
    setData((d) => {
      if (d.notes.some((n) => n.id === note.id)) return d;
      const notes = [...d.notes];
      notes.splice(Math.min(index, notes.length), 0, note);
      return { ...d, notes };
    });
  }, []);

  const toggleHabit = useCallback((id: string, key: string) => {
    setData((d) => ({
      ...d,
      habits: d.habits.map((h) =>
        h.id !== id
          ? h
          : {
              ...h,
              doneOn: h.doneOn.includes(key)
                ? h.doneOn.filter((k) => k !== key)
                : [...h.doneOn, key],
            },
      ),
    }));
  }, []);

  const addHabit = useCallback((name: string) => {
    const id = uid();
    setData((d) => ({ ...d, habits: [...d.habits, { id, name, doneOn: [] }] }));
    return id;
  }, []);

  const removeHabit = useCallback((id: string) => {
    setData((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id) }));
  }, []);

  /** Puts a removed habit back where it was (undo). */
  const restoreHabit = useCallback((habit: Habit, index: number) => {
    setData((d) => {
      if (d.habits.some((h) => h.id === habit.id)) return d;
      const habits = [...d.habits];
      habits.splice(Math.min(index, habits.length), 0, habit);
      return { ...d, habits };
    });
  }, []);

  const resetSample = useCallback(() => setData(sampleData(new Date())), []);
  const clearAll = useCallback(
    () => setData({ tasks: [], notes: [], habits: [], sample: false }),
    [],
  );

  return {
    data,
    toggleTask,
    addTask,
    updateTask,
    removeTask,
    restoreTask,
    addNote,
    removeNote,
    saveNote,
    togglePinNote,
    restoreNote,
    toggleHabit,
    addHabit,
    removeHabit,
    restoreHabit,
    resetSample,
    clearAll,
  };
}

/** Current time, refreshed every 30 seconds. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
