import { formatOdds, itemOdds, type AffixFile, type AffixOdds } from "../../shared/affix-odds";

/** The text for one table cell: "any" is the effect's total, a number is one tier's template. */
export function cellText(odds: AffixOdds, effect: string | undefined, cell: string | undefined): string {
  const tier = cell === "any" ? undefined : Number(cell);
  const found =
    tier === undefined ? odds.effects.find((one) => one.effect === effect) : odds.templates.find((one) => one.effect === effect && one.tier === tier);
  return formatOdds(found?.probability ?? 0);
}

/** Slots shown for a rarity: the bonus slots count only when the bonus is on. */
export function slotCount(slots: number, bonusSlots: number, withBonus: boolean): number {
  return slots + (withBonus ? bonusSlots : 0);
}

// The page prints threat 20, the first rarity and no bonus; this recomputes the table from the same model file, which
// is loaded only on pages that have a table.
function fill(root: HTMLElement, odds: AffixOdds): void {
  for (const row of root.querySelectorAll<HTMLElement>("tr[data-effect]:not(.affix-fixed)")) {
    for (const cell of row.querySelectorAll<HTMLElement>("td[data-cell]")) {
      cell.textContent = cellText(odds, row.dataset.effect, cell.dataset.cell);
    }
  }
}

function start(root: HTMLElement, file: AffixFile): void {
  const slug = root.dataset.affix ?? "";
  const item = Object.hasOwn(file.items, slug) ? file.items[slug] : undefined;
  const controls = root.querySelector<HTMLElement>("[data-affix-controls]");
  const level = root.querySelector<HTMLSelectElement>("[data-affix-level]");
  const rarity = root.querySelector<HTMLSelectElement>("[data-affix-rarity]");
  const bonus = root.querySelector<HTMLInputElement>("[data-affix-bonus]");
  const bonusLabel = bonus?.closest("label");
  const text = (selector: string, value: string): void => {
    const target = root.querySelector<HTMLElement>(selector);
    if (target) target.textContent = value;
  };
  if (!item || !controls || !level) return;

  const update = (): void => {
    const chosen = item.rarities.find((one) => one.rarity === (rarity?.value ?? item.rarities[0]?.rarity));
    if (!chosen) return;
    // The bonus slot only exists for rarities that list one.
    if (bonusLabel) bonusLabel.hidden = chosen.bonusSlots === 0;
    const withBonus = Boolean(bonus?.checked) && chosen.bonusSlots > 0;
    const odds = itemOdds(file, slug, { level: Number(level.value), rarity: chosen.rarity, bonus: withBonus });
    if (!odds) {
      // Stale or foreign data: the table keeps what it shows.
      console.warn(`affix odds: no odds for ${slug} at threat ${level.value}, ${chosen.rarity}`);
      return;
    }
    fill(root, odds);
    text("[data-affix-level-text]", level.value);
    if (rarity?.selectedOptions[0]) text("[data-affix-rarity-text]", rarity.selectedOptions[0].textContent ?? "");
    text("[data-affix-slots-text]", String(slotCount(chosen.slots, chosen.bonusSlots, withBonus)));
  };
  controls.hidden = false;
  for (const control of [level, rarity, bonus]) control?.addEventListener("change", update);
  update();
}

/** Loads the model file (only on pages with a table) and wires the controls; `load` is the JSON import. */
export function mountAffixOdds(root: HTMLElement, load: () => Promise<{ default: unknown }>): void {
  load()
    .then((module) => start(root, module.default as AffixFile))
    .catch((error: unknown) => {
      // The table keeps its default values.
      console.warn("affix odds: the model file did not load", error);
    });
}
