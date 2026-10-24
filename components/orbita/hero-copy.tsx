import type { CSSProperties } from "react";

const WORD = Array.from("Atol");
/* The tagline: a claim in the display voice, then its quieter answer. */
const LINES = [
  { text: "Seu dia é uma ilha.", tone: "text-foreground" },
  { text: "O resto é mar.", tone: "text-muted-foreground" },
];

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * The wordmark and its two-line tagline. "Atol" is set huge, heavy and tight,
 * one solid shape; its letters rise out of a mask one by one.
 */
export function HeroCopy() {
  return (
    <div className="min-w-0">
      <h1 className="wordmark relative flex items-start leading-[0.8] text-foreground text-[min(34vw,9rem)] sm:text-[min(22vw,11rem)] lg:text-[min(15vw,25vh,15.5rem)]">
        <span className="sr-only">Atol</span>
        <span aria-hidden className="rise-mask whitespace-nowrap pr-[0.02em] pb-[0.04em]">
          {WORD.map((ch, i) => (
            <span key={i} className="rise" style={delay(140 + i * 70)}>
              {ch}
            </span>
          ))}
        </span>
      </h1>

      <p className="mt-3 font-display text-[1.375rem] leading-[1.02] font-bold tracking-[-0.03em] sm:text-[1.75rem] lg:mt-[clamp(1rem,3.5vh,2.25rem)] lg:text-[clamp(1.75rem,2.6vw,3rem)]">
        {LINES.map((line, i) => (
          <span key={line.text} className={`rise-mask inline-block pr-[0.3em] lg:block ${line.tone}`}>
            <span className="rise" style={delay(480 + i * 90)}>
              {line.text}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}
