"use client";

import { useEffect, useState, ViewTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Flower2, ListChecks, StickyNote, Sun, type LucideIcon } from "lucide-react";

import { navTypes, sectionIndex, type SectionHref } from "@/components/shared/sections";
import { playSound } from "@/lib/sound";

/*
 * The phone's way between sections: a floating bar at the foot of the screen,
 * hidden from md up, where each page's header carries the same links. It
 * lives in the root layout, so it stays mounted across navigations: the pill
 * glides to the tapped tab at once (before the next page has arrived) and the
 * bar takes on the colours of the section it is heading to.
 *
 * It is its own view-transition group that never animates, so the page
 * slides under it while it holds still (app/styles/tabs.css).
 */

const TABS: { href: SectionHref; label: string; tone: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Hoje", tone: "laguna", Icon: Sun },
  { href: "/tarefas", label: "Tarefas", tone: "mata", Icon: ListChecks },
  { href: "/notas", label: "Notas", tone: "luz", Icon: StickyNote },
  { href: "/habitos", label: "Hábitos", tone: "lav", Icon: Flower2 },
];

/*
 * The pages render on the client only (next/dynamic, ssr: false), so their
 * code is fetched on first visit. Warming the chunks while the phone is idle
 * means a tab opens without waiting on the network for it.
 */
const warmPages = () => {
  void import("@/components/home/home");
  void import("@/components/tarefas/tasks-page");
  void import("@/components/notas/notes-page");
  void import("@/components/habitos/habits-page");
};

const SPRING = { type: "spring", stiffness: 520, damping: 40, mass: 0.9 } as const;

export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();

  // The tab the person tapped, shown as current until the route catches up.
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    setPending(null);
  }

  const inSection = sectionIndex(pathname) >= 0;

  useEffect(() => {
    if (!inSection) return;
    const warm = () => {
      for (const t of TABS) if (t.href !== pathname) router.prefetch(t.href);
      warmPages();
    };
    // Safari has no requestIdleCallback; a plain delay keeps it off the first paint.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(warm, 1200);
    return () => clearTimeout(id);
  }, [inSection, pathname, router]);

  if (!inSection) return null;

  const active = pending ?? pathname;
  const tone = TABS.find((t) => t.href === active)?.tone ?? "laguna";

  return (
    <ViewTransition name="atol-tabs" update="tabs-hold" default="none">
      <nav aria-label="Seções" className="atol-tabs" data-tone={tone}>
        <ul className="atol-tabs-list">
          {TABS.map(({ href, label, Icon }) => {
            const on = href === active;
            return (
              <li key={href} className="atol-tabs-item">
                <Link
                  href={href}
                  aria-current={href === pathname ? "page" : undefined}
                  data-on={on ? "" : undefined}
                  transitionTypes={navTypes(pathname, href)}
                  onClick={(event) => {
                    if (href === active) {
                      // Already here: back to the top instead of a reload.
                      if (href === pathname) {
                        event.preventDefault();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                      return;
                    }
                    setPending(href);
                    playSound("tap");
                  }}
                  className="atol-tab"
                >
                  {on && <motion.span layoutId="atol-tab-pill" transition={SPRING} className="atol-tab-pill" aria-hidden />}
                  <Icon className="atol-tab-icon" strokeWidth={on ? 2.1 : 1.7} aria-hidden />
                  <span className="atol-tab-label">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </ViewTransition>
  );
}
