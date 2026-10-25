"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import type { Habit, OrbitaData } from "@/lib/orbita";

/*
 * Keeps an account's day in step with the server (app/api/data). The browser
 * copy stays the one the pages read and write, so everything opens at once
 * and keeps working offline; this hook mirrors it to the account:
 *
 *   - on opening a page, when the tab comes back into view, and every 30 s
 *     while it is visible, it pulls the server's document;
 *   - shortly after each change, it pushes the browser's document;
 *   - when another device saved in between, it merges the two item by item
 *     against the last version both agreed on (the "base") and pushes the
 *     result, so edits made on two devices at once are both kept.
 *
 * The base and its revision are kept next to the data in localStorage, so a
 * change made offline is still pushed the next time the app opens.
 */

type Meta = { rev: number; base: OrbitaData | null };

const metaKey = (userId: string) => `orbita:v1:${userId}:synced`;
const PUSH_DELAY = 700;
const PULL_EVERY = 30_000;

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function loadMeta(userId: string): Meta {
  try {
    const raw = window.localStorage.getItem(metaKey(userId));
    if (raw) return JSON.parse(raw) as Meta;
  } catch {
    // Unreadable: treated as never synced.
  }
  return { rev: 0, base: null };
}

/* ---------- three-way merge ---------- */

/*
 * Starts from the server's list and replays what this device changed since
 * the base: its deletions, its edits (which win over the server's) and its
 * additions (at the position they had here). An item the server deleted but
 * this device edited is kept.
 */
function mergeList<T extends { id: string }>(
  base: T[],
  local: T[],
  remote: T[],
  mergeItem: (b: T, l: T, r: T) => T = (_, l) => l,
): T[] {
  const b = new Map(base.map((x) => [x.id, x]));
  const l = new Map(local.map((x) => [x.id, x]));
  const r = new Map(remote.map((x) => [x.id, x]));

  const out: T[] = [];
  for (const item of remote) {
    const was = b.get(item.id);
    const mine = l.get(item.id);
    if (was && !mine) continue; // deleted here
    if (was && mine && !same(was, mine)) out.push(mergeItem(was, mine, item)); // edited here
    else out.push(item);
  }
  local.forEach((item, i) => {
    if (r.has(item.id)) return;
    const was = b.get(item.id);
    if (!was || !same(was, item)) out.splice(Math.min(i, out.length), 0, item); // added, or edited here and deleted there
  });
  return out;
}

/* A habit's kept days merge as a set, so marking different days on two devices keeps both. */
function mergeHabit(base: Habit, local: Habit, remote: Habit): Habit {
  const was = new Set(base.doneOn);
  const mine = new Set(local.doneOn);
  const days = new Set(remote.doneOn);
  for (const d of mine) if (!was.has(d)) days.add(d);
  for (const d of was) if (!mine.has(d)) days.delete(d);
  return { ...remote, ...local, doneOn: [...days] };
}

export function mergeData(
  base: OrbitaData | null,
  local: OrbitaData,
  remote: OrbitaData,
  isSample: (d: OrbitaData) => boolean,
): OrbitaData {
  // A device that never synced: its untouched example content gives way to
  // the account's real data, and the other way round.
  if (!base) {
    if (isSample(local)) return remote;
    if (isSample(remote)) return local;
  }
  const b = base ?? { tasks: [], notes: [], habits: [], sample: false };
  return {
    tasks: mergeList(b.tasks, local.tasks, remote.tasks),
    notes: mergeList(b.notes, local.notes, remote.notes),
    habits: mergeList(b.habits, local.habits, remote.habits, mergeHabit),
    sample: local.sample && remote.sample,
  };
}

/* ---------- the hook ---------- */

type Options = {
  /** True when this browser had no copy yet, so `data` is only a placeholder. */
  fresh: boolean;
  /** The example content a brand-new account starts with. */
  makeSample: () => OrbitaData;
  isSample: (d: OrbitaData) => boolean;
};

export function useCloudSync(
  userId: string,
  data: OrbitaData,
  setData: Dispatch<SetStateAction<OrbitaData>>,
  { fresh, makeSample, isSample }: Options,
) {
  const dataRef = useRef(data);
  const ready = useRef(false);
  const push = useRef<(opts?: { keepalive?: boolean }) => void>(() => {});
  const timer = useRef(0);

  // The latest data, for the async work below.
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let meta = loadMeta(userId);
    let placeholder = fresh;
    let busy = false;
    let again = false;
    let alive = true;

    const saveMeta = (next: Meta) => {
      meta = next;
      try {
        window.localStorage.setItem(metaKey(userId), JSON.stringify(next));
      } catch {
        // Private mode or quota: the merge base lives in memory for now.
      }
    };

    const show = (next: OrbitaData) => {
      if (same(next, dataRef.current)) return;
      dataRef.current = next;
      setData(next);
    };

    /** Takes the server's document, replaying this device's unsaved changes on top. */
    const adopt = (remote: OrbitaData, rev: number) => {
      const local = placeholder ? remote : dataRef.current;
      placeholder = false;
      const merged = mergeData(meta.base, local, remote, isSample);
      saveMeta({ rev, base: remote });
      show(merged);
    };

    const pending = () => !placeholder && !same(dataRef.current, meta.base);

    const schedule = (delay = PUSH_DELAY) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => doPush(), delay);
    };

    async function doPush({ keepalive = false } = {}) {
      if (!ready.current || !pending()) return;
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      const sending = dataRef.current;
      try {
        const res = await fetch("/api/data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: sending, baseRev: meta.rev }),
          keepalive,
        });
        if (res.ok) {
          const { rev } = (await res.json()) as { rev: number };
          saveMeta({ rev, base: sending });
        } else if (res.status === 409) {
          const { data: remote, rev } = (await res.json()) as { data: OrbitaData | null; rev: number };
          if (remote) adopt(remote, rev);
          else saveMeta({ rev: 0, base: null });
          again = true;
        }
        // Anything else (signed out, server down): try again on the next change or pull.
      } catch {
        // Offline: the change waits in the browser.
      } finally {
        busy = false;
        if (again && alive) {
          again = false;
          schedule(0);
        }
      }
    }
    push.current = doPush;

    async function pull() {
      if (busy) return;
      try {
        const res = await fetch("/api/data", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const { data: remote, rev } = (await res.json()) as { data: OrbitaData | null; rev: number };
        if (!alive || busy) return;
        if (remote) {
          if (rev !== meta.rev || placeholder) adopt(remote, rev);
        } else {
          // Nothing saved for this account yet: this browser's copy becomes the first.
          if (meta.rev !== 0) saveMeta({ rev: 0, base: null });
          if (placeholder) {
            placeholder = false;
            show(makeSample());
          }
        }
      } catch {
        // Offline: a browser with no copy yet falls back to the example content.
        if (placeholder) {
          placeholder = false;
          show(makeSample());
        }
      }
      ready.current = true;
      if (pending()) schedule(0);
    }

    void pull();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void pull();
    }, PULL_EVERY);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void pull();
      else void doPush({ keepalive: true });
    };
    const onPageHide = () => void doPush({ keepalive: true });
    const onOnline = () => void pull();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    return () => {
      // Leaving the page (switching sections): save what has not gone yet.
      if (!busy && pending()) void doPush({ keepalive: true });
      alive = false;
      ready.current = false;
      window.clearInterval(id);
      window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
    };
    // The options are fixed for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, setData]);

  // Each change goes up shortly after it is made.
  useEffect(() => {
    if (!ready.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => push.current(), PUSH_DELAY);
  }, [data]);
}
