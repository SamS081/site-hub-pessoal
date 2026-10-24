/*
 * Logo Orbit, adapted from xevrion lab.
 * https://lab.xevrion.dev/lab/logo-orbit
 *
 * Órbita additions: items accept `onSelect` so they can navigate, labels
 * stay visible on touch screens, where there is no hover to reveal them, and
 * orbits accept a starting `phase` so items begin (and, with reduced motion,
 * stay) scattered instead of lined up on the horizontal axis. Also additive:
 * per-orbit `tilt` and `roll` (inclined, crossing orbits), always-visible
 * labels, a one-time entrance where items ease out into orbit, and class
 * overrides for the item body and label. Every item exposes its colour as
 * `--orbit-color` for styling. With a custom `itemClassName`, depth fades are handed to the
 * body as `--orbit-opacity` instead of `opacity` on the moving wrapper (an
 * ancestor with opacity would become a backdrop root and blank out any
 * backdrop-filter glass on the body), the icon wrapper is exposed as
 * `data-slot="logo-orbit-icon"`, and the body carries `data-glass-pointer`.
 * Scene pass: a `depth` strength for the perspective cue, a `backdrop` render
 * prop that receives the stage size (to draw the orbit paths, see
 * `orbitPoint`), and an `occluder` disc that fades labels out while they
 * overlap it. Stage and label sizes are read on resize, not per frame.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";

export type LogoOrbitItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /* Brand color shown on hover when it has enough contrast. */
  color?: string;
  /* Called when the item is clicked or activated from the keyboard. */
  onSelect?: () => void;
};

export type Orbit = {
  items: LogoOrbitItem[];
  /* Radius as a share of the stage width. */
  radius: number;
  /* Seconds per lap; negative reverses direction. */
  lap: number;
  /* Starting angle in radians; 0 puts the first item at the right. */
  phase?: number;
  /* Vertical squash of this orbit; overrides the stage `tilt`. */
  tilt?: number;
  /* Rotation of this orbit's plane on screen, in radians. */
  roll?: number;
};

type LogoOrbitProps = {
  orbits: Orbit[];
  children: React.ReactNode;
  className?: string;
  iconSize?: number;
  paused?: boolean;
  /* Default vertical squash for every orbit (0.42). */
  tilt?: number;
  /* "hover" shows labels on hover (and always on touch); "always" keeps them. */
  labels?: "hover" | "always";
  /* Items ease out from the centre into orbit once, on first run. */
  entrance?: boolean;
  /* Replace the default item body and label classes. */
  itemClassName?: string;
  labelClassName?: string;
  /*
   * Strength of the depth cue (scale and fade of far items), 0 to 1. 1 is the
   * original deep perspective; lower keeps far items closer to full size.
   */
  depth?: number;
  /*
   * Drawn behind everything, sized to the stage: receives the stage's pixel
   * size so orbit paths can be traced exactly where the items travel.
   */
  backdrop?: (size: { w: number; h: number }) => React.ReactNode;
  /*
   * Radius, as a share of the stage width, of an opaque disc at the centre
   * (the planet). A label whose box overlaps it fades out, so a caption never
   * sits unreadably over the disc.
   */
  occluder?: number;
};

/* Where an orbit puts an angle, relative to the stage centre, in pixels. */
export function orbitPoint(orbit: Orbit, angle: number, w: number, tilt = TILT) {
  const rx = (orbit.radius * w) / 2;
  const ex = Math.cos(angle) * rx;
  const ey = Math.sin(angle) * rx * (orbit.tilt ?? tilt);
  const roll = orbit.roll ?? 0;
  return {
    x: ex * Math.cos(roll) - ey * Math.sin(roll),
    y: ex * Math.sin(roll) + ey * Math.cos(roll),
  };
}

const TILT = 0.42;
const BRAKE = 4;
const ENTRANCE_MS = 1700;
const ENTRANCE_DELAY_MS = 220;
const ENTRANCE_STAGGER_MS = 90;

function readable(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return false;
  const n = parseInt(value, 16);
  if (Number.isNaN(n)) return false;
  const lum =
    0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum > 40 && lum < 225;
}

export function LogoOrbit({
  orbits,
  children,
  className,
  iconSize = 44,
  paused = false,
  tilt = TILT,
  labels = "hover",
  entrance = false,
  itemClassName,
  labelClassName,
  depth: depthCue = 1,
  backdrop,
  occluder = 0,
}: LogoOrbitProps) {
  const reduceMotion = useReducedMotion();
  const customBody = itemClassName !== undefined;
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hovering = useRef(false);
  const [active, setActive] = useState<string | null>(null);
  /* Entrance start time; set once so a re-run (new orbits) never replays it. */
  const introStart = useRef<number | null>(null);
  /* The latest placement pass, so a hover/focus change can re-place at rest. */
  const placeRef = useRef<(() => void) | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const wantsSize = backdrop !== undefined;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !wantsSize) return;
    const measure = () => {
      const w = stage.offsetWidth;
      const h = stage.offsetHeight;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [wantsSize]);

  const flat = orbits.flatMap((orbit, r) =>
    orbit.items.map((item, i) => ({ item, r, i, n: orbit.items.length })),
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const turns = orbits.map((orbit) => orbit.phase ?? 0);
    let speed = 1;
    let frame = 0;
    let visible = true;
    let last = performance.now();
    const animate = !paused && !reduceMotion;
    if (entrance && animate && introStart.current === null) {
      introStart.current = performance.now() + ENTRANCE_DELAY_MS;
    }
    const intro = animate ? introStart.current : null;

    /* Label boxes, read once (and on resize), never inside the frame loop. */
    let labelBoxes: { w: number; h: number }[] = [];
    const measureLabels = () => {
      labelBoxes = labelRefs.current.map((el) => ({ w: el?.offsetWidth ?? 0, h: el?.offsetHeight ?? 0 }));
    };
    if (occluder > 0) measureLabels();

    /* Stage size, likewise read up front and on resize only. */
    let w = stage.offsetWidth;
    let h = stage.offsetHeight;

    const place = () => {
      const now = performance.now();
      flat.forEach(({ r, i, n }, k) => {
        const el = itemRefs.current[k];
        if (!el) return;
        const orbit = orbits[r]!;
        // Entrance: exponential ease-out from the centre, with a short swirl.
        let grow = 1;
        if (intro !== null) {
          const t = (now - intro - k * ENTRANCE_STAGGER_MS) / ENTRANCE_MS;
          grow = t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
        }
        const angle =
          turns[r]! + (i / n) * Math.PI * 2 - (1 - grow) * 0.9 * Math.sign(orbit.lap || 1);
        const rx = ((orbit.radius * w) / 2) * (0.3 + 0.7 * grow);
        const ex = Math.cos(angle) * rx;
        const ey = Math.sin(angle) * rx * (orbit.tilt ?? tilt);
        const roll = orbit.roll ?? 0;
        const x = ex * Math.cos(roll) - ey * Math.sin(roll);
        const y = ex * Math.sin(roll) + ey * Math.cos(roll);
        const depth = Math.sin(angle);
        const near = (depth + 1) / 2;
        el.style.left = "0px";
        el.style.top = "0px";
        const scale = 1 - depthCue * (0.3 - near * 0.35);
        el.style.transform = `translate(${(w / 2 + x).toFixed(1)}px, ${(h / 2 + y).toFixed(1)}px) translate(-50%, -50%) scale(${(scale * (0.6 + 0.4 * grow)).toFixed(3)})`;
        const fade = ((1 - depthCue * 0.72 * (1 - near)) * grow).toFixed(3);
        if (customBody) el.style.setProperty("--orbit-opacity", fade);
        else el.style.opacity = fade;
        const label = labelRefs.current[k];
        const box = labelBoxes[k];
        if (label && box && occluder > 0) {
          // Distance from the disc centre to the label's box (box measured
          // unscaled, then placed under the scaled body), in px past the rim.
          const k2 = scale * (0.6 + 0.4 * grow);
          const lw = box.w * k2;
          const lh = box.h * k2;
          const top = y + (iconSize / 2 + 6) * k2;
          const dx = Math.max(Math.abs(x) - lw / 2, 0);
          const dy = Math.max(top, 0, -(top + lh));
          const clear = Math.hypot(dx, dy) - occluder * w;
          const t = Math.min(Math.max((clear - 2) / 18, 0), 1);
          // Hovered or focused, the label gets its own capsule: always show it.
          const shown = el.dataset.on === "true" || el.contains(document.activeElement);
          label.style.opacity = shown ? "1" : (t * t * (3 - 2 * t)).toFixed(3);
        }
        el.style.zIndex = depth > 0 ? "3" : "1";
      });
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const target = hovering.current ? 0 : 1;
      speed += (target - speed) * (1 - Math.exp(-BRAKE * dt));
      orbits.forEach((orbit, r) => {
        turns[r]! += ((Math.PI * 2) / orbit.lap) * dt * speed;
      });
      place();
      frame = visible ? requestAnimationFrame(step) : 0;
    };

    placeRef.current = place;
    place();
    if (!animate) return;

    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    });
    io.observe(stage);
    const ro = new ResizeObserver(() => {
      w = stage.offsetWidth;
      h = stage.offsetHeight;
      if (occluder > 0) measureLabels();
      place();
    });
    ro.observe(stage);
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
    };
    // flat is derived from orbits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbits, paused, reduceMotion, tilt, entrance, customBody, depthCue, occluder, iconSize]);

  /* Under reduced motion nothing loops, so re-place when the active item changes. */
  useEffect(() => {
    const frame = requestAnimationFrame(() => placeRef.current?.());
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div
      data-slot="logo-orbit"
      ref={stageRef}
      className={cn("relative isolate aspect-16/10 w-full", className)}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") hovering.current = true;
      }}
      onPointerLeave={() => {
        hovering.current = false;
        setActive(null);
      }}
    >
      {backdrop && size.w > 0 && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          {backdrop(size)}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-2 grid place-items-center text-center">
        {children}
      </div>

      {flat.map(({ item }, k) => {
        const on = active === item.label;
        const Icon = item.icon;
        const fill =
          on && item.color && readable(item.color) ? item.color : undefined;

        return (
          <div
            key={item.label}
            data-slot="logo-orbit-item"
            ref={(el) => {
              itemRefs.current[k] = el;
            }}
            data-on={on}
            className={cn(
              "absolute top-0 left-0 will-change-transform data-[on=true]:z-4!",
              !customBody && "data-[on=true]:opacity-100!",
            )}
            /* Until the first placement, sit at the centre, not the corner. */
            style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
          >
            <button
              type="button"
              aria-label={item.label}
              data-slot="logo-orbit-body"
              data-glass-pointer={customBody ? "" : undefined}
              onClick={item.onSelect}
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") setActive(item.label);
              }}
              onPointerLeave={() => setActive(null)}
              onFocus={() => {
                hovering.current = true;
                setActive(item.label);
              }}
              onBlur={() => {
                hovering.current = false;
                setActive(null);
              }}
              className={
                itemClassName ??
                "relative grid touch-manipulation place-items-center rounded-full bg-card text-foreground shadow-elevated-2xs outline-hidden transition-shadow hover:shadow-elevated-sm focus-visible:ring-2 focus-visible:ring-ring"
              }
              style={
                {
                  width: iconSize,
                  height: iconSize,
                  "--orbit-color": item.color,
                } as React.CSSProperties
              }
            >
              <span
                data-slot="logo-orbit-icon"
                className={
                  customBody
                    ? undefined
                    : "grid size-[45%] place-items-center transition-[color,scale] duration-200 ease-out *:size-full"
                }
                style={customBody ? undefined : { color: fill, scale: on ? "1.12" : "1" }}
              >
                <Icon aria-hidden="true" />
              </span>
              <span
                data-slot="logo-orbit-label"
                ref={(el) => {
                  labelRefs.current[k] = el;
                }}
                aria-hidden="true"
                className={
                  labelClassName ??
                  cn(
                    "pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded-full bg-foreground px-2 py-0.5 text-xs font-medium whitespace-nowrap text-background transition-[opacity,translate] duration-150 ease-out [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100",
                    on || labels === "always" ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
                  )
                }
              >
                {item.label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
export default LogoOrbit;
