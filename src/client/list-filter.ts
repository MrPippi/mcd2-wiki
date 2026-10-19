import { foldForSearch } from "../../shared/lang";

export const ALL_VARIANTS = "all";

/** Whether a card shows for the chosen variant button and the (already folded) search text. */
export function matchesFilter(variant: string, text: string, itemVariant: string | undefined, names: string | undefined): boolean {
  return (variant === ALL_VARIANTS || itemVariant === variant) && (names ?? "").includes(text);
}

/** A grouped list (the bestiary) hides a group's heading once every card in it is filtered out. */
export function groupHidden(hiddenFlags: readonly boolean[]): boolean {
  return hiddenFlags.every(Boolean);
}

export function mountListFilter(root: Document): void {
  const filter = root.querySelector<HTMLElement>(".list-filter");
  const input = filter?.querySelector<HTMLInputElement>(".filter-text");
  const buttons = [...(filter?.querySelectorAll<HTMLButtonElement>("button[data-variant]") ?? [])];
  const items = [...root.querySelectorAll<HTMLElement>("[data-names]")];
  const noResults = root.querySelector<HTMLElement>(".no-results");
  let variant = ALL_VARIANTS;

  const apply = () => {
    const text = foldForSearch(input?.value.trim() ?? "", root.documentElement.lang);
    let visible = 0;
    for (const item of items) {
      const show = matchesFilter(variant, text, item.dataset.variant, item.dataset.names);
      item.hidden = !show;
      if (show) visible += 1;
    }
    if (noResults) noResults.hidden = visible > 0;
    for (const group of root.querySelectorAll<HTMLElement>("[data-group]")) {
      group.hidden = groupHidden([...group.querySelectorAll<HTMLElement>("[data-names]")].map((item) => Boolean(item.hidden)));
    }
  };

  input?.addEventListener("input", apply);
  for (const button of buttons) {
    button.addEventListener("click", () => {
      variant = button.dataset.variant ?? ALL_VARIANTS;
      for (const other of buttons) other.setAttribute("aria-pressed", String(other === button));
      apply();
    });
  }
}
