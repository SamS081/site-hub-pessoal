"use client";

import { useEffect, useRef } from "react";

/*
 * The world behind Atol: a night ocean. The air is the abyss, lifting into a
 * dim teal glow on the horizon; below it dark, calm water with slow lagoon
 * ripples and a glint under the island; faint specks in the upper air; a soft
 * turquoise glow behind the centre, where the 3D island (orb-stage.tsx) floats
 * on its transparent canvas; low sea mist; a fine static grain.
 *
 * Every texture is painted once (gradients and SVG feTurbulence noise
 * rasterised as background images); the only things that change per frame
 * are `transform` and `opacity` (CSS keyframes in app/styles/sky.css, plus a
 * faint pointer parallax written straight to `style.transform`), so the whole
 * scene runs on the compositor. Reduced motion freezes it into a still picture.
 */

/* Parallax strength, in px at the viewport edge, for the far air and the near mist. */
const DEPTHS = [5, 12] as const;

export function Sky() {
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);

  /*
   * Pointer parallax, fine pointers only and never under reduced motion. The
   * pointer is sampled once per frame at most; the easing is a CSS transition
   * on transform, so no rAF loop keeps running while the pointer is still.
   */
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let px = 0;
    let py = 0;

    const apply = () => {
      frame = 0;
      DEPTHS.forEach((depth, i) => {
        const el = layerRefs.current[i];
        if (el) el.style.transform = `translate3d(${(-px * depth).toFixed(2)}px, ${(-py * depth * 0.5).toFixed(2)}px, 0)`;
      });
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const sync = () => {
      window.removeEventListener("pointermove", onMove);
      if (fine.matches && !reduce.matches) {
        window.addEventListener("pointermove", onMove, { passive: true });
      } else {
        px = 0;
        py = 0;
        apply();
      }
    };

    sync();
    fine.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      fine.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div aria-hidden className="sky pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* Air and water colour: abyss above, a teal glow on the horizon, dark sea below. */}
      <div className="sky-air absolute inset-0" />

      {/* Far layer: specks in the upper air and the glow behind the island. */}
      <div
        ref={(el) => {
          layerRefs.current[0] = el;
        }}
        className="sky-parallax absolute -inset-[3%]"
      >
        <span className="sky-specks sky-specks-a" />
        <span className="sky-specks sky-specks-b" />
        <span className="sky-glow" />
      </div>

      {/* Water: ripples sliding slowly, a glint column under the island. */}
      <div className="sky-water absolute inset-x-0 bottom-0">
        <span className="sky-ripples sky-ripples-dark" />
        <span className="sky-ripples sky-ripples-light" />
        <span className="sky-glint" />
      </div>

      {/* Near layer: low sea mist on the horizon and over the water. */}
      <div
        ref={(el) => {
          layerRefs.current[1] = el;
        }}
        className="sky-parallax absolute -inset-[4%]"
      >
        <span className="sky-mist sky-mist-horizon" />
        <span className="sky-mist sky-mist-left" />
        <span className="sky-mist sky-mist-right" />
      </div>

      <div className="sky-vignette absolute inset-0" />
      <div className="sky-grain absolute inset-0" />
    </div>
  );
}
