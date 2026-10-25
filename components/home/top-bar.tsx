"use client";

import type { CSSProperties, MouseEvent } from "react";
import Link from "next/link";
import { LogOut, Volume2, VolumeX } from "lucide-react";

import { AtolMark } from "@/components/shared/logo";
import { navTypes } from "@/components/shared/sections";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/login/actions";
import { playSound, setSoundOn, useSoundOn } from "@/lib/sound";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/*
 * The app's four sections: Hoje (this screen), Tarefas, Notas and Hábitos.
 */
const SECTIONS = [
  { label: "Hoje", current: true },
  { label: "Tarefas", current: false, href: "/tarefas" },
  { label: "Notas", current: false, href: "/notas" },
  { label: "Hábitos", current: false, href: "/habitos" },
];

/* A section that is not there yet: a small shake and a soft low note. */
const hold = (event: MouseEvent<HTMLAnchorElement>) => {
  event.preventDefault();
  const el = event.currentTarget;
  el.classList.remove("nudge");
  void el.offsetWidth;
  el.classList.add("nudge");
  playSound("nope");
};

/** Four dots in a square, a "Menu ⁘" glyph that turns when the menu opens. */
function Dots() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="size-3 transition-[rotate] duration-500 ease-(--ease-spring) group-data-popup-open:rotate-45 motion-reduce:transition-none">
      <circle cx="3" cy="3" r="1.5" fill="currentColor" />
      <circle cx="9" cy="3" r="1.5" fill="currentColor" />
      <circle cx="3" cy="9" r="1.5" fill="currentColor" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** Sounds on/off. Stays open so the confirming note is heard in context. */
function SoundItem() {
  const on = useSoundOn();
  const toggle = () => {
    if (on) {
      playSound("toggle-off");
      setSoundOn(false);
    } else {
      setSoundOn(true);
      playSound("toggle-on");
    }
  };

  return (
    <DropdownMenuItem
      closeOnClick={false}
      onClick={toggle}
      className="h-10 gap-2.5 px-2.5 text-muted-foreground data-highlighted:text-foreground"
    >
      <span className="icon-swap size-4" aria-hidden>
        <Volume2 strokeWidth={1.5} data-hidden={on ? undefined : ""} />
        <VolumeX strokeWidth={1.5} data-hidden={on ? "" : undefined} />
      </span>
      Sons
      <span className="ml-auto text-xs tabular-nums">{on ? "ligados" : "desligados"}</span>
    </DropdownMenuItem>
  );
}

export function TopBar({ name }: { name: string }) {
  return (
    <header className="relative z-30 shrink-0">
      <div className="grid h-16 grid-cols-[1fr_auto] items-center gap-4 px-(--gutter) md:grid-cols-[1fr_auto_1fr] lg:h-[clamp(4.5rem,11vh,6.5rem)]">
        <a
          href="#atol"
          aria-label="Atol, início"
          className="glass-button fade-in grid size-11 place-items-center justify-self-start rounded-full text-foreground lg:size-12"
          style={delay(80)}
        >
          <AtolMark className="size-6 lg:size-7" />
        </a>

        <nav aria-label="Seções" className="hidden md:block">
          <ul className="flex items-center gap-[clamp(1.75rem,3.2vw,3.25rem)] text-sm font-medium text-foreground/80">
            {SECTIONS.map((s, i) => (
              <li key={s.label} className="fade-in" style={delay(200 + i * 60)}>
                {s.current ? (
                  <a href="#atol" aria-current="page" className="ink-link text-foreground">
                    {s.label}
                  </a>
                ) : s.href ? (
                  <Link href={s.href} transitionTypes={navTypes("/", s.href)} className="ink-link inline-block hover:text-foreground">
                    {s.label}
                  </Link>
                ) : (
                  <a
                    href={`#${s.label.toLowerCase()}`}
                    aria-disabled="true"
                    title="Em breve"
                    onClick={hold}
                    className="ink-link inline-block cursor-default hover:text-foreground"
                  >
                    {s.label}
                    <span className="sr-only"> (em breve)</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="fade-in justify-self-end" style={delay(320)}>
          <DropdownMenu onOpenChange={(open) => playSound(open ? "open" : "close")}>
            <DropdownMenuTrigger
              aria-label={`Menu da conta de ${name}`}
              className="group glass-button flex h-11 max-w-[11rem] items-center gap-3 rounded-full px-4 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="truncate">{name}</span>
              <Dots />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={6} className="w-64">
              <div className="px-2.5 pt-2 pb-2.5">
                <p className="truncate text-sm font-medium text-foreground">{name}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  Tarefas, notas e hábitos salvos na sua conta
                </p>
              </div>
              <DropdownMenuSeparator />
              <SoundItem />
              <DropdownMenuItem
                onClick={() => void signOut()}
                className="h-10 gap-2.5 px-2.5 text-muted-foreground data-highlighted:text-foreground"
              >
                <LogOut strokeWidth={1.5} />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
