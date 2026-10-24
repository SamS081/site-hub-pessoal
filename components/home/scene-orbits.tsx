"use client";

import { useEffect, useId, useRef, useState } from "react";

/*
 * The nautical-chart plate around the atoll: hairline rings in ink at low
 * strength, one dotted arc, a few solid dots resting on the rings and two
 * tiny buoys (the .scene-moonlet* classes) that travel
 * the rings very slowly. Drawn behind the 3D island. Purely decorative.
 *
 * The plate is painted once per stage size (pure SVG, measured with a
 * ResizeObserver, never per frame). The buoys are HTML dots on a rotating
 * square squashed into the ring's ellipse, so their whole motion is a CSS
 * `rotate` keyframe on the compositor; see app/styles/sky.css. Under reduced
 * motion that keyframe is paused at each buoy's phase, a still picture.
 */

type Ring = {
  /* Radius as a share of the stage width. */
  radius: number;
  /* Vertical squash of the ring's ellipse. */
  tilt: number;
  /* Rotation of the ring's plane on screen, in radians. */
  roll: number;
  /* "solid": a hairline; "dotted": a faint hairline with a dotted arc over part of it. */
  style: "solid" | "dotted";
  /* Dotted arc span, in radians along the ring (start, end), when dotted. */
  arc?: readonly [number, number];
  /* Angles (radians) where a small solid dot rests on the ring. */
  dots?: readonly number[];
  /* A buoy travelling the ring: start angle, seconds per lap (negative: counter-clockwise). */
  moonlet?: { phase: number; lap: number };
};

/*
 * Angles are radians, 0 at the right, clockwise (screen y points down).
 * Wide: a 5/4 stage, the diorama ~70% of its width; the inner ring passes
 * behind the water column, the outer opens wide like a chart's great circle.
 * Narrow: a 4/5 stage, the diorama ~90% of its width; both rings stay inside
 * the phone's width, crosshairs included.
 */
const RINGS_WIDE: readonly Ring[] = [
  {
    radius: 0.68,
    tilt: 0.84,
    roll: -0.08,
    style: "dotted",
    arc: [-2.15, 0.35],
    dots: [2.55],
    moonlet: { phase: -0.6, lap: 150 },
  },
  {
    radius: 0.88,
    tilt: 0.8,
    roll: 0.1,
    style: "solid",
    dots: [-1.05, 2.05],
    moonlet: { phase: 2.9, lap: -230 },
  },
];
const RINGS_NARROW: readonly Ring[] = [
  {
    radius: 0.74,
    tilt: 0.9,
    roll: -0.12,
    style: "dotted",
    arc: [-2.15, 0.35],
    dots: [2.55],
    moonlet: { phase: -0.6, lap: 150 },
  },
  {
    radius: 0.88,
    tilt: 0.98,
    roll: 0.1,
    style: "solid",
    dots: [-1.05, 2.05],
    moonlet: { phase: 2.9, lap: -230 },
  },
];

function ringPoint(ring: Ring, angle: number, w: number) {
  const rx = (ring.radius * w) / 2;
  const ex = Math.cos(angle) * rx;
  const ey = Math.sin(angle) * rx * ring.tilt;
  return {
    x: ex * Math.cos(ring.roll) - ey * Math.sin(ring.roll),
    y: ex * Math.sin(ring.roll) + ey * Math.cos(ring.roll),
  };
}

function arcPath(ring: Ring, w: number, cx: number, cy: number, a0: number, a1: number) {
  const rx = (ring.radius * w) / 2;
  const ry = rx * ring.tilt;
  const rot = (ring.roll * 180) / Math.PI;
  const p0 = ringPoint(ring, a0, w);
  const p1 = ringPoint(ring, a1, w);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${(cx + p0.x).toFixed(1)} ${(cy + p0.y).toFixed(1)} A ${rx.toFixed(1)} ${ry.toFixed(1)} ${rot.toFixed(2)} ${large} ${sweep} ${(cx + p1.x).toFixed(1)} ${(cy + p1.y).toFixed(1)}`;
}

function Plate({ rings, w, h }: { rings: readonly Ring[]; w: number; h: number }) {
  const id = useId();
  const cx = w / 2;
  const cy = h / 2;

  return (
    <svg
      className="scene-orbits absolute inset-0 size-full overflow-visible"
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
    >
      {rings.map((ring, r) => {
        const rx = (ring.radius * w) / 2;
        const ry = rx * ring.tilt;
        const rot = (ring.roll * 180) / Math.PI;
        const grad = `${id}-depth-${r}`;
        const reach = Math.max(rx, ry);
        return (
          <g key={r}>
            {/* Far side (top) a touch fainter than the near side: a quiet depth cue. */}
            <defs>
              <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1={0} y1={cy - reach} x2={0} y2={cy + reach}>
                <stop offset="0" stopColor="currentColor" stopOpacity={ring.style === "solid" ? 0.12 : 0.08} />
                <stop offset="1" stopColor="currentColor" stopOpacity={ring.style === "solid" ? 0.22 : 0.14} />
              </linearGradient>
            </defs>
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              transform={rot ? `rotate(${rot.toFixed(2)} ${cx} ${cy})` : undefined}
              stroke={`url(#${grad})`}
            />
            {ring.style === "dotted" && ring.arc && (
              <path
                d={arcPath(ring, w, cx, cy, ring.arc[0], ring.arc[1])}
                strokeOpacity={0.4}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeDasharray="0 5.5"
              />
            )}
            {ring.dots?.map((a) => {
              const p = ringPoint(ring, a, w);
              return <circle key={`d${a}`} cx={cx + p.x} cy={cy + p.y} r={2.4} fill="currentColor" fillOpacity={0.55} stroke="none" />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

/*
 * One buoy: a square as wide as the ring's diameter, centred on the stage,
 * rolled and squashed into the ring's ellipse; inside it a square that turns
 * (the only animated property), carrying the dot on its right edge. The dot's
 * path is exactly `ringPoint` over time. Phase and lap reach the CSS as a
 * negative delay and a duration, so a paused animation still sits at its phase.
 */
function Moonlet({ ring }: { ring: Ring }) {
  if (!ring.moonlet) return null;
  const { phase, lap } = ring.moonlet;
  const seconds = Math.abs(lap);
  const turn = (((phase / (2 * Math.PI)) % 1) + 1) % 1;
  const progress = lap > 0 ? turn : 1 - turn;
  return (
    <span
      className="scene-moonlet-track"
      style={{
        width: `${ring.radius * 100}%`,
        transform: `rotate(${ring.roll}rad) scale(1, ${ring.tilt})`,
      }}
    >
      <span
        className="scene-moonlet-spin"
        style={{
          animationDuration: `${seconds}s`,
          animationDelay: `${(-progress * seconds).toFixed(2)}s`,
          animationDirection: lap > 0 ? "normal" : "reverse",
        }}
      >
        <span className="scene-moonlet" />
      </span>
    </span>
  );
}

export function SceneOrbits({ wide }: { wide: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const rings = wide ? RINGS_WIDE : RINGS_NARROW;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev && Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
          ? prev
          : { w: width, h: height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 text-foreground">
      {size && size.w > 0 && <Plate rings={rings} w={size.w} h={size.h} />}
      <div className="scene-moonlets absolute inset-0">
        {rings.map((ring, i) => (
          <Moonlet key={`${wide ? "w" : "n"}${i}`} ring={ring} />
        ))}
      </div>
    </div>
  );
}
