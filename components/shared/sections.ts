/*
 * The app's four sections, in the order they sit in the tab bar. The order
 * gives each navigation a direction: moving right slides the next page in
 * from the right ("nav-forward"), moving left from the left ("nav-back").
 * See the view-transition rules in app/styles/tabs.css.
 */
export const SECTION_HREFS = ["/", "/tarefas", "/notas", "/habitos"] as const;

export type SectionHref = (typeof SECTION_HREFS)[number];

export function sectionIndex(path: string) {
  return SECTION_HREFS.indexOf(path as SectionHref);
}

/** The transition types for a navigation from one section to another. */
export function navTypes(from: string, to: string): string[] {
  const a = sectionIndex(from);
  const b = sectionIndex(to);
  if (a < 0 || b < 0 || a === b) return [];
  return [b > a ? "nav-forward" : "nav-back"];
}
