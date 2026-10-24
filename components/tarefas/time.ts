/*
 * Time helpers for the Tarefas page: reading a time out of what the person
 * types ("Ligar pro dentista às 15h30"), the period a time falls in, how far
 * a time is from now, and the presets offered when picking one.
 */

import { minutesOf } from "@/lib/orbita";

export const pad = (n: number) => String(n).padStart(2, "0");
export const toTime = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

export type Detected = { time: string; title: string; text: string };

/*
 * Times people write in Portuguese, anywhere in the text:
 *   15:30 · 15h · 15h30 · 15hs · às 9 · as 9 · meio-dia · meia-noite
 * A bare number ("20 páginas") is not a time: it needs ":", "h" or "às".
 */
const PATTERNS: { re: RegExp; read: (m: RegExpMatchArray) => [number, number] | null }[] = [
  { re: /(?:^|\s)(?:(?:à|a)s?\s+)?meio[\s-]dia(?=$|[\s.,!?])/i, read: () => [12, 0] },
  { re: /(?:^|\s)(?:(?:à|a)s?\s+)?meia[\s-]noite(?=$|[\s.,!?])/i, read: () => [0, 0] },
  { re: /(?:^|\s)(?:(?:à|a)s?\s+)?(\d{1,2}):(\d{2})(?:\s*h(?:s|oras?)?)?(?=$|[\s.,!?])/i, read: (m) => [Number(m[1]), Number(m[2])] },
  { re: /(?:^|\s)(?:(?:à|a)s?\s+)?(\d{1,2})\s*h(?:s|oras?)?\s*(\d{2})?(?=$|[\s.,!?])/i, read: (m) => [Number(m[1]), Number(m[2] ?? 0)] },
  { re: /(?:^|\s)(?:à|a)s\s+(\d{1,2})(?=$|[\s.,!?])/i, read: (m) => [Number(m[1]), 0] },
];

/** The first time written in `text`, and the text without it; null if there is none. */
export function detectTime(text: string): Detected | null {
  for (const { re, read } of PATTERNS) {
    const m = text.match(re);
    if (!m || m.index === undefined) continue;
    const hm = read(m);
    if (!hm) continue;
    const [h, min] = hm;
    if (h > 23 || min > 59) continue;
    const title = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length))
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([.,!?])/g, "$1")
      .trim();
    return { time: `${pad(h)}:${pad(min)}`, title, text: m[0].trim() };
  }
  return null;
}

export const PERIODS = [
  { id: "manha", label: "Manhã", from: 0 },
  { id: "tarde", label: "Tarde", from: 12 * 60 },
  { id: "noite", label: "Noite", from: 18 * 60 },
] as const;

export function periodOf(time: string) {
  const m = minutesOf(time);
  return m >= PERIODS[2].from ? PERIODS[2] : m >= PERIODS[1].from ? PERIODS[1] : PERIODS[0];
}

/** "agora", "em 25 min", "em 2 h", "há 40 min", "há 3 h". */
export function relative(diff: number) {
  const a = Math.abs(diff);
  if (a < 1) return "agora";
  const text = a < 60 ? `${a} min` : a % 60 === 0 || a >= 180 ? `${Math.round(a / 60)} h` : `${Math.floor(a / 60)} h ${a % 60}`;
  return diff > 0 ? `em ${text}` : `há ${text}`;
}

/** One hour from now, rounded up to the next quarter. */
export function inAnHour(now: Date) {
  const m = now.getHours() * 60 + now.getMinutes() + 60;
  return toTime(Math.min(23 * 60 + 45, Math.ceil(m / 15) * 15));
}

export const PRESETS = [
  { label: "Manhã", time: "09:00" },
  { label: "Almoço", time: "12:00" },
  { label: "Tarde", time: "15:00" },
  { label: "Fim do dia", time: "18:00" },
  { label: "Noite", time: "20:00" },
];
