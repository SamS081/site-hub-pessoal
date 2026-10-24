"use client";

import { useEffect, type CSSProperties, type RefObject } from "react";

/*
 * The forest around the Tarefas page, without any 3D: flat layers at
 * different depths that drift apart as the pointer moves and the page
 * scrolls, so the photograph reads as a place you look into.
 *
 *   far   the photograph itself
 *         light shafts leaning in from the upper right, breathing slowly
 *         two banks of mist drifting sideways
 *   mid   the blurred veil over the left half (fixed: a design plane)
 *         dust motes floating in the light, at two depths
 *   near  dark foliage silhouettes in the corners, out of focus, swaying
 *
 * Motion is transform and opacity only. Pointer and scroll positions are
 * written as CSS variables (--px, --py, --sy) on the layers' root by
 * `useParallax`, once per frame at most, and only while something moves.
 * Reduced motion: everything holds still.
 */

/** Writes eased pointer (--px, --py: -0.5..0.5) and scroll (--sy: px) onto each target. */
export function useParallax(targets: RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let frame = 0;

    const write = () => {
      const sy = reduce.matches ? 0 : window.scrollY;
      for (const ref of targets) {
        const el = ref.current;
        if (!el) continue;
        el.style.setProperty("--px", x.toFixed(4));
        el.style.setProperty("--py", y.toFixed(4));
        el.style.setProperty("--sy", sy.toFixed(1));
      }
    };

    const tick = () => {
      x += (tx - x) * 0.07;
      y += (ty - y) * 0.07;
      write();
      frame = Math.abs(tx - x) > 0.0005 || Math.abs(ty - y) > 0.0005 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || reduce.matches || !fine.matches) return;
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
      kick();
    };
    const onScroll = () => kick();

    write();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, [targets]);
}

/* ---------- foliage silhouettes ---------- */

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* A pointed oval leaf, base at the origin, pointing up (−y). */
const leaf = (w: number, l: number) =>
  `M0 0 C ${w * 0.9} ${-l * 0.18}, ${w} ${-l * 0.62}, 0 ${-l} C ${-w} ${-l * 0.62}, ${-w * 0.9} ${-l * 0.18}, 0 0 Z`;

/*
 * A frond: an arching stem from the corner with leaves on alternate sides,
 * smaller towards the tip. Drawn in a 400×400 box, anchored at (0, 0).
 */
function Frond({ seed, leaves = 9, reach = 360, bend = 0.35, width = 26, length = 92 }: { seed: number; leaves?: number; reach?: number; bend?: number; width?: number; length?: number }) {
  const rand = seeded(seed);
  const end = { x: reach, y: reach * bend };
  const ctrl = { x: reach * 0.55, y: -reach * 0.08 };
  const at = (t: number) => ({
    x: 2 * (1 - t) * t * ctrl.x + t * t * end.x,
    y: 2 * (1 - t) * t * ctrl.y + t * t * end.y,
  });
  const tangent = (t: number) => Math.atan2(2 * (1 - t) * ctrl.y + 2 * t * (end.y - ctrl.y), 2 * (1 - t) * ctrl.x + 2 * t * (end.x - ctrl.x));

  const parts = Array.from({ length: leaves }, (_, i) => {
    const t = 0.12 + (i / leaves) * 0.86;
    const p = at(t);
    const side = i % 2 ? 1 : -1;
    const angle = (tangent(t) * 180) / Math.PI + 90 + side * (48 + rand() * 18) - 90;
    const size = 1 - t * 0.45;
    return { ...p, angle, w: width * size * (0.85 + rand() * 0.3), l: length * size * (0.85 + rand() * 0.3), side };
  });

  return (
    <g>
      <path d={`M0 0 Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`} fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
      {parts.map((p, i) => (
        <path key={i} d={leaf(p.w, p.l)} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(p.angle + 90).toFixed(1)})`} fill="currentColor" />
      ))}
      <path d={leaf(width * 0.5, length * 0.55)} transform={`translate(${end.x} ${end.y}) rotate(${((tangent(1) * 180) / Math.PI + 90).toFixed(1)})`} fill="currentColor" />
    </g>
  );
}

/* One corner's cluster: two or three fronds fanned from the same corner. */
function Foliage({ className, style, seed }: { className: string; style?: CSSProperties; seed: number }) {
  return (
    <div aria-hidden className={`mata-foliage ${className}`} style={style}>
      <svg viewBox="-20 -60 440 440" className="mata-foliage-svg">
        <g transform="rotate(8)">
          <Frond seed={seed} />
        </g>
        <g transform="rotate(38) scale(0.82)">
          <Frond seed={seed + 3} leaves={8} bend={0.25} />
        </g>
        <g transform="rotate(-14) scale(0.66)">
          <Frond seed={seed + 7} leaves={7} bend={0.5} />
        </g>
      </svg>
    </div>
  );
}

/* ---------- dust motes ---------- */

const MOTES = (() => {
  const rand = seeded(19);
  return Array.from({ length: 34 }, (_, i) => ({
    left: 38 + rand() * 60,
    top: 4 + rand() * 88,
    size: 1.5 + rand() * 3.5,
    dur: 9 + rand() * 12,
    delay: -rand() * 20,
    near: i % 4 === 0,
  }));
})();

function Motes({ near }: { near: boolean }) {
  return (
    <div aria-hidden className={`mata-layer ${near ? "mata-motes-near" : "mata-motes-far"}`}>
      {MOTES.filter((m) => m.near === near).map((m, i) => (
        <span
          key={i}
          className="mata-mote"
          style={
            {
              left: `${m.left}%`,
              top: `${m.top}%`,
              "--size": `${near ? m.size * 2.2 : m.size}px`,
              "--dur": `${m.dur}s`,
              animationDelay: `${m.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ---------- the whole ground ---------- */

export function Ambience({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={rootRef} aria-hidden className="mata-ambience">
      <div className="mata-layer mata-photo" />
      <div className="mata-layer mata-rays" />
      <div className="mata-layer mata-mist">
        <span className="mata-mist-bank mata-mist-a" />
        <span className="mata-mist-bank mata-mist-b" />
      </div>
      <div className="mata-veil" />
      <Motes near={false} />
      <div className="mata-shade" />
      <Motes near />
      <Foliage className="mata-foliage-tl" seed={4} />
      <Foliage className="mata-foliage-tr" seed={12} />
      <Foliage className="mata-foliage-bl" seed={27} />
      <Foliage className="mata-foliage-br" seed={33} />
      <div className="mata-grain" />
    </div>
  );
}
