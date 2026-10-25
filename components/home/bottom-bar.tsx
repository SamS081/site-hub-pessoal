import type { CSSProperties } from "react";

import { longDate, shortDate } from "@/components/home/day";
import { dateKey } from "@/lib/orbita";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** The foot of the screen: the copyright and today's date. On phones the tab bar takes its place. */
export function BottomBar({ now }: { now: Date }) {
  return (
    <footer className="relative z-20 hidden shrink-0 md:block">
      <div className="flex h-12 items-center justify-between gap-4 px-(--gutter) text-[0.6875rem] font-medium tracking-[0.12em] text-muted-foreground uppercase lg:h-[clamp(3.5rem,8vh,5rem)] lg:text-xs">
        <p className="fade-in whitespace-nowrap" style={delay(1500)}>
          © {now.getFullYear()} Atol
        </p>
        <p className="fade-in whitespace-nowrap text-foreground/80" style={delay(1600)}>
          <time dateTime={dateKey(now)}>
            <span className="hidden sm:inline">{longDate(now)}</span>
            <span className="sm:hidden">{shortDate(now)}</span>
          </time>
        </p>
      </div>
    </footer>
  );
}
