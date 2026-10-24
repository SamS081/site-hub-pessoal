import { cn } from "@/lib/utils";

/*
 * The Atol mark: an atoll seen from above. A reef ring broken by two passes
 * (where the sea gets into the lagoon) around a small solid island, your day.
 *
 * Geometry (viewBox 32, centre 16,16):
 *   reef    r 10, stroke 2.75, round caps, two arcs. A wide pass at upper right
 *           (centred on -45°) and a narrow one at lower left (150°), so it never
 *           reads as a target, a power icon or a loading spinner.
 *   island  r 3.5, solid, at the centre of the lagoon.
 * Colour: tone "color" paints the reef in lagoon turquoise and the island in
 * currentColor (sand); tone "mono" uses currentColor for both.
 *
 * Motion:
 *   entrance  the two reef arcs draw clockwise, one after the other, then the
 *             island surfaces with a small spring.
 *   hover     on the parent link/button (or its focus-visible) the reef turns
 *             a little, like the tide moving round the island.
 *   reduced   no drawing or turning: the mark simply fades in.
 */

const MARK_CSS = `
.atol-mark-reef { transform-box: view-box; transform-origin: 16px 16px; }
.atol-mark-island { transform-box: fill-box; transform-origin: center; }
@media (prefers-reduced-motion: no-preference) {
  .atol-mark-arc { animation: atol-mark-draw 1s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both; }
  .atol-mark-arc-b { animation-delay: 0.18s; }
  .atol-mark-island { animation: atol-mark-land 0.7s 0.45s var(--ease-spring, cubic-bezier(0.34, 1.36, 0.64, 1)) both; }
  .atol-mark-reef { transition: transform 0.7s var(--ease-spring, cubic-bezier(0.34, 1.36, 0.64, 1)); }
}
@media (prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) {
  :is(a, button):hover .atol-mark-reef { transform: rotate(32deg); }
}
@media (prefers-reduced-motion: no-preference) {
  :is(a, button):focus-visible .atol-mark-reef { transform: rotate(32deg); }
}
@media (prefers-reduced-motion: reduce) {
  .atol-mark { animation: atol-mark-fade 0.3s ease both; }
}
@keyframes atol-mark-draw { from { stroke-dashoffset: 1; } }
@keyframes atol-mark-land { from { transform: scale(0.3); opacity: 0; } }
@keyframes atol-mark-fade { from { opacity: 0; } }
`;

const R = 10;
const at = (deg: number) => {
  const r = (deg * Math.PI) / 180;
  return `${(16 + R * Math.cos(r)).toFixed(2)} ${(16 + R * Math.sin(r)).toFixed(2)}`;
};
/* Angles in degrees, 0 at the right, clockwise (screen y points down). */
const ARC_A = `M${at(-23)}A${R} ${R} 0 0 1 ${at(135)}`;
const ARC_B = `M${at(165)}A${R} ${R} 0 0 1 ${at(293)}`;

export function AtolMark({ className, tone = "color" }: { className?: string; tone?: "color" | "mono" }) {
  const reef = tone === "color" ? "var(--lagoon)" : "currentColor";
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("atol-mark shrink-0", className)} aria-hidden focusable="false">
      <style href="atol-mark" precedence="default">
        {MARK_CSS}
      </style>
      <g className="atol-mark-reef" stroke={reef} strokeWidth="2.75" strokeLinecap="round">
        <path className="atol-mark-arc" d={ARC_A} pathLength={1} strokeDasharray="1 1" />
        <path className="atol-mark-arc atol-mark-arc-b" d={ARC_B} pathLength={1} strokeDasharray="1 1" />
      </g>
      <circle className="atol-mark-island" cx="16" cy="16" r="3.5" fill="currentColor" />
    </svg>
  );
}

const SIZES = {
  sm: { mark: "size-7", text: "text-[1.375rem]", gap: "gap-2" },
  md: { mark: "size-8", text: "text-[1.625rem]", gap: "gap-2.5" },
  lg: { mark: "size-10", text: "text-[2.125rem]", gap: "gap-3" },
} as const;

export function AtolLogo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center text-foreground", s.gap, className)}>
      <AtolMark className={s.mark} />
      <span className={cn("wordmark leading-none", s.text)}>Atol</span>
    </span>
  );
}
