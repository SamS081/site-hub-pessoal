import type { CSSProperties } from "react";

import { clock, PERIODS, type DaySummary } from "@/components/home/day";
import { cn } from "@/lib/utils";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const R = 31;

/**
 * A clock face for the whole day, like a reef seen from above: a faint sand
 * ring, the lagoon arc is the share of the day gone, the coral dot is now.
 * Static figure, not a control.
 */
export function NowRing({ day }: { day: DaySummary }) {
  const share = day.dayShare;
  const angle = share * Math.PI * 2 - Math.PI / 2;
  const dotX = 32 + R * Math.cos(angle);
  const dotY = 32 + R * Math.sin(angle);
  const percent = Math.round(share * 100);

  return (
    <div
      role="img"
      aria-label={`Agora são ${clock(day.now)}; ${percent}% do dia já passou`}
      className="flex items-center gap-4"
    >
      <svg viewBox="0 0 64 64" className="size-[clamp(3.5rem,4.6vw,4.25rem)] shrink-0 overflow-visible" aria-hidden>
        <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="fade-in" style={delay(1200)} />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke="var(--lagoon)"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          strokeDasharray="1 1"
          transform="rotate(-90 32 32)"
          className="draw-stroke"
          style={{ ...delay(1300), strokeDashoffset: 1 - share }}
        />
        <circle cx={dotX} cy={dotY} r="6" fill="var(--coral)" fillOpacity="0.22" className="fade-in" style={delay(2100)} />
        <circle cx={dotX} cy={dotY} r="3.2" fill="var(--coral)" stroke="var(--background)" strokeWidth="1.5" className="fade-in" style={delay(2100)} />
        <circle cx="32" cy="32" r="3.5" fill="currentColor" className="fade-in" style={delay(1500)} />
      </svg>
      <p className="fade-up text-xs leading-[1.5] font-semibold tracking-[0.12em] text-foreground uppercase" style={delay(1400)}>
        Agora <span className="tabular-nums">{clock(day.now)}</span>
        <br />
        <span className="text-muted-foreground tabular-nums">{percent}% do dia</span>
      </p>
    </div>
  );
}

/** Bottom-left: the three periods of the day, the current one lit. */
export function PeriodNote({ day }: { day: DaySummary }) {
  return (
    <div className="fade-up" style={delay(1300)}>
      <div className="flex items-center gap-3">
        <ol aria-label="Período do dia" className="flex items-center gap-2.5">
          {PERIODS.map((name, i) => (
            <li
              key={name}
              title={name}
              aria-current={i === day.period ? "time" : undefined}
              className={cn(
                "size-2 rounded-full",
                i === day.period ? "bg-lagoon shadow-[0_0_10px_rgb(47_211_192/0.6)]" : "bg-foreground/25",
              )}
            >
              <span className="sr-only">{name}</span>
            </li>
          ))}
        </ol>
        <span aria-hidden className="text-xs font-semibold tracking-[0.12em] text-foreground uppercase">
          {PERIODS[day.period]}
        </span>
      </div>
    </div>
  );
}
