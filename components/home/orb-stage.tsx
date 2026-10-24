"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";

import { SceneOrbits } from "@/components/home/scene-orbits";

/*
 * The centre of the home: the atoll, a small 3D diorama (island-scene.tsx)
 * drawn over a nautical-chart plate of hairline rings (scene-orbits.tsx).
 * Decorative only: the page means the same without it, so the whole stage is
 * hidden from assistive tech. The WebGL scene is a separate client chunk,
 * never prerendered; the stage fades it in once its first frame is up
 * (app/styles/island.css).
 */

const IslandScene = dynamic(() => import("@/components/home/island-scene"), { ssr: false });

const WIDE_QUERY = "(min-width: 40rem)";
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function OrbStage() {
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
  const [ready, setReady] = useState(false);
  const [onReady] = useState(() => () => setReady(true));

  return (
    <div
      aria-hidden
      className="scene-stage relative aspect-4/5 w-[min(100%,calc((100svh-12.5rem)*0.8))] select-none sm:aspect-5/4 sm:w-[min(100%,calc((100svh-12.5rem)*1.25),64rem)]"
    >
      <SceneOrbits wide={wide} />

      <div data-ready={ready} className="island-stage absolute inset-0">
        <IslandScene onReady={onReady} />
      </div>
    </div>
  );
}
