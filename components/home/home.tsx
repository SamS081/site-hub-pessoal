"use client";

import { useEffect } from "react";

import { BottomBar } from "@/components/home/bottom-bar";
import { summarize } from "@/components/home/day";
import { NowRing, PeriodNote } from "@/components/home/day-marks";
import { HeroCopy } from "@/components/home/hero-copy";
import { OrbStage } from "@/components/home/orb-stage";
import { Sky } from "@/components/shared/sky";
import { StatsRail } from "@/components/home/stats-rail";
import { TopBar } from "@/components/home/top-bar";
import { useNow, useOrbita } from "@/lib/orbita";
import { playSound } from "@/lib/sound";

/*
 * One screen, never scrolls. On desktop the island stage sits centred behind
 * two text columns, like a poster: the huge wordmark, tagline and period on
 * the left, the day's figures and the clock ring on the right, the night
 * ocean (Sky) showing through the island's transparent canvas. On phones the
 * same parts stack: wordmark, island (takes the remaining height), a row of
 * figures, and the tab bar (components/shared/tab-bar.tsx) below it all.
 */
export default function Home({ user }: { user: { id: string; name: string } }) {
  const { data } = useOrbita(user.id);
  const now = useNow();
  const day = summarize(data, now);

  // A warm chord as the wordmark rises, when arriving from the login.
  useEffect(() => {
    const id = window.setTimeout(() => playSound("welcome", { onlyIfAwake: true }), 160);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="relative isolate flex h-[calc(100dvh-var(--tabbar-space))] flex-col overflow-hidden">
      <Sky />
      <TopBar name={user.name} />

      <main className="relative flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-2 lg:px-(--gutter)">
        {/* The stage is a size container so the island box can fit both ways. */}
        <section
          id="atol"
          aria-label="Atol"
          className="relative order-2 min-h-0 flex-1 [container-type:size] lg:absolute lg:inset-0 lg:z-0"
        >
          <div className="absolute inset-0 grid place-items-center">
            <div className="w-[min(100cqw,80cqh)] sm:w-[min(100cqw,150cqh)] lg:w-[min(58cqw,150cqh)]">
              <OrbStage />
            </div>
          </div>
        </section>

        <div className="pointer-events-none relative z-10 order-1 flex flex-col justify-between px-(--gutter) pt-2 lg:px-0 lg:pt-[clamp(0.5rem,5vh,3.5rem)] lg:pb-[clamp(1rem,4vh,2.5rem)]">
          <HeroCopy />
          <div className="hidden lg:block">
            <PeriodNote day={day} />
          </div>
        </div>

        <div className="pointer-events-none relative z-10 order-3 flex flex-col items-end justify-between px-(--gutter) pb-3 lg:px-0 lg:pt-[clamp(0.5rem,6vh,4rem)] lg:pb-[clamp(1rem,4vh,2.5rem)]">
          <div className="w-full lg:w-auto">
            <StatsRail day={day} />
          </div>
          <div className="hidden lg:block">
            <NowRing day={day} />
          </div>
        </div>
      </main>

      <BottomBar now={now} />
    </div>
  );
}
