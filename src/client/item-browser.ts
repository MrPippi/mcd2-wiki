import { bindCursorTooltip, type CursorTooltip } from "./cursor-tooltip";

/** What a change of `hidden` flags (ListFilter hides cards) leaves showing: the sheet and tooltip never keep a filtered-out item. */
export function staleOverlays(openCardHidden: boolean | "until-found" | undefined, tooltipCardHidden: boolean | "until-found" | undefined): { readonly closeSheet: boolean; readonly hideTooltip: boolean } {
  return { closeSheet: Boolean(openCardHidden), hideTooltip: Boolean(tooltipCardHidden) };
}

/** A click outside the sheet and the item links dismisses the sheet (without moving focus). */
export function dismissesSheet(insideSheetOrLink: boolean): boolean {
  return !insideSheetOrLink;
}

export function mountItemBrowser(root: Document): void {
  const browser = root.querySelector<HTMLElement>(".item-browser");
  const grid = browser?.querySelector<HTMLElement>(".item-grid");
  const tooltipEl = root.querySelector<HTMLElement>(".cursor-tooltip");
  const sheet = root.querySelector<HTMLElement>(".item-sheet");
  const sheetBody = sheet?.querySelector<HTMLElement>(".sheet-body");
  const sheetView = sheet?.querySelector<HTMLAnchorElement>(".sheet-view");
  const cards = [...(browser?.querySelectorAll<HTMLElement>(".entry-card") ?? [])];
  // Mice get the cursor tooltip; touch screens (no hover, or a coarse pointer) get the bottom sheet.
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  let openCard: HTMLElement | null = null;

  const contentOf = (card: HTMLElement): DocumentFragment | null => {
    const template = card.querySelector<HTMLTemplateElement>("template.item-tip");
    return template ? (template.content.cloneNode(true) as DocumentFragment) : null;
  };

  /** Esc and × give focus back to the item; an outside tap or the filter leaves focus where the user put it. */
  const closeSheet = (restoreFocus: boolean) => {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    if (restoreFocus) openCard?.querySelector<HTMLAnchorElement>("a.item-link")?.focus();
    openCard = null;
  };

  const openSheet = (card: HTMLElement, href: string) => {
    const content = contentOf(card);
    if (!sheet || !sheetBody || !sheetView || !content) return;
    sheetBody.replaceChildren(content);
    sheetView.href = href;
    sheet.hidden = false;
    sheet.focus();
    openCard = card;
  };

  const tooltip: CursorTooltip | null = finePointer && grid && tooltipEl ? bindCursorTooltip(grid, tooltipEl, contentOf) : null;

  for (const card of cards) {
    const link = card.querySelector<HTMLAnchorElement>("a.item-link");
    if (!link || finePointer) continue;
    link.addEventListener("click", (event) => {
      if (openCard === card) return;
      event.preventDefault();
      openSheet(card, link.href);
    });
  }

  sheet?.querySelector(".sheet-close")?.addEventListener("click", () => closeSheet(true));
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSheet(true);
  });
  root.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (!dismissesSheet(Boolean(target?.closest(".item-sheet, .entry-card a.item-link")))) return;
    closeSheet(false);
  });
  // ListFilter hides cards by setting `hidden`; never leave the sheet or tooltip showing an item that is filtered out.
  new MutationObserver(() => {
    const stale = staleOverlays(openCard?.hidden, tooltip?.current()?.hidden);
    if (stale.closeSheet) closeSheet(false);
    if (stale.hideTooltip) tooltip?.hide();
  }).observe(browser ?? root.body, { attributes: true, attributeFilter: ["hidden"], subtree: true });
}
