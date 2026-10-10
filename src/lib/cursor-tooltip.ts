import { besideElement, followCursor, type Size } from "./tooltip-position";

export interface CursorTooltip {
  /** Hides the tooltip, e.g. when the list filter hides the item under it. */
  readonly hide: () => void;
  /** The card the tooltip is describing, if any. */
  readonly current: () => HTMLElement | null;
}

const CARD = ".entry-card";
const LINK = "a.item-link";

/**
 * Shows each card's details in one shared tooltip that follows the mouse, or sits beside the card on keyboard focus.
 * `contentOf` supplies a fresh copy of a card's details. Touch input is ignored; the caller handles it.
 */
export function bindCursorTooltip(
  grid: HTMLElement,
  tooltip: HTMLElement,
  contentOf: (card: HTMLElement) => DocumentFragment | null,
): CursorTooltip {
  let card: HTMLElement | null = null;
  /** Keyboard focus anchors the tooltip to the card; the mouse makes it follow the cursor. */
  let mode: "mouse" | "keyboard" = "mouse";
  let size: Size = { width: 0, height: 0 };
  let cursor = { x: 0, y: 0 };
  let frame = 0;

  const viewport = (): Size => ({ width: document.documentElement.clientWidth, height: window.innerHeight });
  const moveTo = ({ left, top }: { left: number; top: number }) => {
    tooltip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  };

  const hide = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    card?.classList.remove("is-active");
    card?.querySelector(LINK)?.removeAttribute("aria-describedby");
    card = null;
    tooltip.hidden = true;
  };

  /** Fills the tooltip for `next` and measures it once; positions are then computed from the cached size. */
  const show = (next: HTMLElement): boolean => {
    const content = contentOf(next);
    if (!content) {
      hide();
      return false;
    }
    if (card !== next) hide();
    tooltip.replaceChildren(content);
    tooltip.hidden = false;
    size = { width: tooltip.offsetWidth, height: tooltip.offsetHeight };
    card = next;
    card.classList.add("is-active");
    card.querySelector(LINK)?.setAttribute("aria-describedby", tooltip.id);
    return true;
  };

  const follow = () => {
    frame = 0;
    if (card) moveTo(followCursor(cursor, size, viewport()));
  };
  const anchor = () => {
    frame = 0;
    if (card) moveTo(besideElement(card.getBoundingClientRect(), size, viewport()));
  };

  grid.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    cursor = { x: event.clientX, y: event.clientY };
    const over = (event.target as Element | null)?.closest<HTMLElement>(CARD) ?? null;
    if (!over) return;
    if ((over !== card || mode !== "mouse") && !show(over)) return;
    mode = "mouse";
    if (!frame) frame = requestAnimationFrame(follow);
  });

  grid.addEventListener("pointerout", (event) => {
    if (event.pointerType !== "mouse" || !card) return;
    const into = (event.relatedTarget as Element | null)?.closest(CARD);
    if (into !== card) hide();
  });

  grid.addEventListener("focusin", (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(LINK);
    // A mouse click also focuses the link; only keyboard focus moves the tooltip beside the card.
    const next = link?.closest<HTMLElement>(CARD);
    if (!link || !next || !link.matches(":focus-visible")) return;
    if (!show(next)) return;
    mode = "keyboard";
    anchor();
  });

  grid.addEventListener("focusout", (event) => {
    const into = (event.relatedTarget as Element | null)?.closest(CARD);
    if (card && into !== card && !card.matches(":hover")) hide();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
  // Focusing an off-screen card scrolls the page, so a keyboard tooltip follows its card; a mouse tooltip would sit at
  // a stale cursor position, so it hides until the next mouse move brings it back.
  const onViewportChange = () => {
    if (mode === "keyboard" && card) {
      if (!frame) frame = requestAnimationFrame(anchor);
      return;
    }
    hide();
  };
  window.addEventListener("scroll", onViewportChange, { passive: true });
  window.addEventListener("resize", onViewportChange);

  return { hide, current: () => card };
}
