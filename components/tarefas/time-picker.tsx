"use client";

import { useRef, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, X } from "lucide-react";

import { inAnHour, pad, PRESETS } from "@/components/tarefas/time";
import { playSound } from "@/lib/sound";

/*
 * Picking a time, in glass: a row of presets (in an hour, morning, lunch…),
 * then two columns, hours and minutes in steps of five, the chosen ones lit.
 * Every choice applies at once; "Pronto" only closes. "Sem horário" clears.
 * The trigger is whatever the caller renders inside it.
 */

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function TimePicker({
  value,
  onChange,
  now,
  label,
  className,
  children,
  align = "end",
}: {
  value: string | null;
  onChange: (time: string | null) => void;
  now: Date;
  /** Accessible name of the trigger. */
  label: string;
  className?: string;
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const [h, m] = value ? value.split(":").map(Number) : [null, null];
  const soon = inAnHour(now);

  const set = (time: string | null) => {
    playSound("tap");
    onChange(time);
  };

  // Bring the chosen hour and minute into view when the popup opens.
  const reveal = (open: boolean) => {
    if (!open) return;
    requestAnimationFrame(() => {
      for (const el of [hoursRef.current, minutesRef.current]) {
        el?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "center" });
      }
    });
  };

  return (
    <Popover.Root onOpenChange={(open) => (playSound(open ? "open" : "close"), reveal(open))}>
      <Popover.Trigger aria-label={label} className={className}>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={10} align={align} className="z-50 outline-none">
          <Popover.Popup className="mata-popover w-[18.5rem] p-3 outline-none">
            <div className="flex items-baseline justify-between px-1 pt-0.5">
              <Popover.Title className="mata-caps">Horário</Popover.Title>
              <p className="font-mono text-[1.375rem] leading-none tabular-nums">
                {value ?? <span className="text-(--mata-faint)">--:--</span>}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => set(soon)} aria-pressed={value === soon} className="mata-preset">
                Em 1 h <span className="font-mono text-(--mata-faint)">{soon}</span>
              </button>
              {PRESETS.map((p) => (
                <button key={p.time} type="button" onClick={() => set(p.time)} aria-pressed={value === p.time} className="mata-preset">
                  {p.label} <span className="font-mono text-(--mata-faint)">{p.time}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="mata-caps px-1 pb-1.5 text-[0.625rem]">Hora</p>
                <div ref={hoursRef} className="mata-wheel" role="group" aria-label="Hora">
                  {HOURS.map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      aria-pressed={h === hour}
                      onClick={() => set(`${pad(hour)}:${pad(m ?? 0)}`)}
                      className="mata-wheel-item"
                    >
                      {pad(hour)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mata-caps px-1 pb-1.5 text-[0.625rem]">Minuto</p>
                <div ref={minutesRef} className="mata-wheel" role="group" aria-label="Minuto">
                  {MINUTES.map((minute) => (
                    <button
                      key={minute}
                      type="button"
                      aria-pressed={m !== null && Math.floor(m / 5) * 5 === minute}
                      onClick={() => set(`${pad(h ?? now.getHours())}:${pad(minute)}`)}
                      className="mata-wheel-item"
                    >
                      {pad(minute)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => set(null)}
                disabled={value === null}
                className="mata-btn h-9 rounded-full px-3 text-[0.8125rem] font-semibold text-(--mata-muted)"
              >
                <X className="size-3.5" aria-hidden />
                Sem horário
              </button>
              <Popover.Close className="mata-btn mata-btn-leaf h-9 rounded-full px-4 text-[0.8125rem]">
                <Check className="size-3.5" strokeWidth={2.6} aria-hidden />
                Pronto
              </Popover.Close>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
