"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { animate, useReducedMotion } from "motion/react";

import { clock, type DaySummary } from "@/components/home/day";
import { cn } from "@/lib/utils";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** A whole number that counts up once from zero on mount. */
function CountUp({ value, at }: { value: number; at: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !first.current || value === 0) {
      el.textContent = String(value);
      first.current = false;
      return;
    }
    first.current = false;
    el.textContent = "0";
    const controls = animate(0, value, {
      duration: 1.1,
      delay: at / 1000,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, at, reduce]);

  return <span ref={ref}>{value}</span>;
}

function Stat({
  label,
  children,
  unit,
  extra,
  at,
  className,
  figureClassName,
}: {
  label: string;
  children: ReactNode;
  unit: ReactNode;
  extra?: ReactNode;
  at: number;
  className?: string;
  figureClassName?: string;
}) {
  return (
    <div className={cn("fade-up min-w-0", className)} style={delay(at)}>
      <dt className="truncate text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase sm:text-[0.6875rem] lg:text-xs">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1.5 font-display text-[1.75rem] leading-none font-bold tracking-[-0.04em] text-foreground tabular-nums sm:text-[2rem] lg:mt-2 lg:text-[clamp(2.25rem,3.2vw,3.25rem)]",
          figureClassName,
        )}
      >
        {children}
      </dd>
      <dd className="mt-1 text-[0.6875rem] text-muted-foreground sm:text-xs lg:mt-1.5 lg:text-[0.8125rem]">
        <span className="block truncate">{unit}</span>
        {extra}
      </dd>
    </div>
  );
}

/**
 * Three real figures from the store: a small spaced label, a big heavy
 * number, a small unit. A tall vertical rail on desktop, a row of three on
 * phones. Accent is spent once per figure: the task bar in lagoon, the week's
 * habit dots in lagoon, the next appointment's time in coral (now).
 */
export function StatsRail({ day }: { day: DaySummary }) {
  const taskRatio = day.tasksTotal ? day.tasksDone / day.tasksTotal : 0;

  return (
    <dl className="grid grid-cols-3 gap-4 lg:w-[clamp(12rem,15vw,15rem)] lg:grid-cols-1 lg:gap-[clamp(1.25rem,5vh,3rem)]">
      <Stat
        label="Tarefas de hoje"
        at={900}
        unit={day.tasksTotal ? "feitas" : "nenhuma para hoje"}
        extra={
          day.tasksTotal > 0 && (
            <div
              aria-hidden
              className="relative mt-3 hidden h-px lg:-mr-(--gutter) lg:mt-4 lg:block"
            >
              <span className="draw-x absolute inset-0 bg-foreground/15" style={delay(1000)} />
              <span
                className="draw-x absolute -inset-y-px left-0 rounded-full bg-lagoon"
                style={{ ...delay(1150), width: `${taskRatio * 100}%` }}
              />
              <span
                className="fade-in absolute top-1/2 size-[7px] -translate-1/2 rounded-full bg-lagoon shadow-[0_0_0_3px_var(--background),0_0_12px_rgb(47_211_192/0.7)]"
                style={{ ...delay(1700), left: `${taskRatio * 100}%` }}
              />
            </div>
          )
        }
      >
        {day.tasksTotal ? (
          <>
            <CountUp value={day.tasksDone} at={1000} />
            <span className="text-muted-foreground">/{day.tasksTotal}</span>
          </>
        ) : (
          "0"
        )}
      </Stat>

      <Stat
        label="Hábitos da semana"
        at={1000}
        unit={day.habitsPossible ? "marcados" : "nenhum hábito ainda"}
        extra={
          day.habitsPossible > 0 && (
            <ol aria-hidden className="mt-3 hidden gap-1.5 lg:flex">
              {day.weekShares.map((share, i) => (
                <li
                  key={i}
                  className={cn(
                    "fade-in size-[5px] rounded-full",
                    share === null ? "border border-foreground/30" : "bg-lagoon",
                    i === day.todayIndex && "outline outline-offset-2 outline-lagoon/60",
                  )}
                  style={{
                    ...delay(1300 + i * 50),
                    opacity: share === null ? undefined : 0.2 + share * 0.8,
                  }}
                />
              ))}
            </ol>
          )
        }
      >
        {day.habitsPossible ? (
          <>
            <CountUp value={day.habitsMarked} at={1100} />
            <span className="text-muted-foreground">/{day.habitsPossible}</span>
          </>
        ) : (
          "0"
        )}
      </Stat>

      {day.next ? (
        <Stat
          label="A seguir"
          at={1100}
          figureClassName="text-coral"
          unit={<span title={day.next.title}>{day.next.title}</span>}
        >
          {day.next.time}
        </Stat>
      ) : (
        <Stat label="Agora" at={1100} unit="nada mais agendado">
          {clock(day.now)}
        </Stat>
      )}
    </dl>
  );
}
