import type { Category } from "../../shared/config";
import { adjacentCategory, keyStep } from "../../shared/tabs";

/** Which ends of the scrolling strip have more tabs beyond them (CSS fades only those edges). */
export function stripEdges(scrollLeft: number, scrollWidth: number, clientWidth: number): { readonly atStart: boolean; readonly atEnd: boolean } {
  return { atStart: scrollLeft <= 1, atEnd: scrollLeft >= scrollWidth - clientWidth - 1 };
}

export function mountCategoryTabs(root: Document): void {
  const nav = root.querySelector<HTMLElement>(".category-tabs");
  const links = [...(nav?.querySelectorAll<HTMLAnchorElement>("a[data-category]") ?? [])];
  const order = links.map((link) => link.dataset.category as Category);
  nav?.querySelector("[aria-current='page']")?.scrollIntoView({ block: "nearest", inline: "center" });

  // Mark the strip's ends so CSS fades only an edge with more tabs beyond it.
  const strip = nav?.querySelector<HTMLElement>(".tab-list");
  const markEdges = (): void => {
    if (!strip) return;
    const { atStart, atEnd } = stripEdges(strip.scrollLeft, strip.scrollWidth, strip.clientWidth);
    strip.toggleAttribute("data-at-start", atStart);
    strip.toggleAttribute("data-at-end", atEnd);
  };
  strip?.addEventListener("scroll", markEdges, { passive: true });
  window.addEventListener("resize", markEdges);
  markEdges();

  root.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null;
    const step = keyStep(event.key, {
      tagName: target?.tagName,
      isContentEditable: target?.isContentEditable ?? false,
      modifier: event.ctrlKey || event.metaKey || event.altKey,
    });
    if (step === null || order.length === 0) return;
    const next = adjacentCategory(order, nav?.dataset.current as Category | undefined, step);
    const link = links.find((candidate) => candidate.dataset.category === next);
    if (link) window.location.assign(link.href);
  });
}
