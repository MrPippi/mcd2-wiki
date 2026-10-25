/** The build page's "build effects" section in the browser: every effect and enchantment on the build, with effect totals. */
import { ROMAN } from "../lib/build/card";
import type { BuildPayload } from "../lib/build/parse";
import type { Build, Effects, Enchants } from "../lib/build/slots";
import { buildTotals, type TotalPart, type TotalRow } from "../lib/build/totals";

const ICON_SIZE = 28;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const made = document.createElement(tag);
  made.className = className;
  if (text !== undefined) made.textContent = text;
  return made;
};

/** "Melee weapon · III · 30%", or "Helmet · Built-in · 10%". */
const partText = (part: TotalPart, labels: BuildPayload["labels"]): string =>
  [labels.slots[part.slot], part.builtIn ? labels.totalsBuiltIn : part.tier !== undefined ? ROMAN[part.tier] : undefined, part.value]
    .filter((piece): piece is string => piece !== undefined && piece !== "")
    .join(" · ");

function totalRow(row: TotalRow, labels: BuildPayload["labels"]): HTMLLIElement {
  const item = element("li", "build-total");
  item.dataset.total = row.slug;
  const link = element("a", "build-total-name");
  link.href = row.href;
  const icon = element("span", "build-icon build-icon-small");
  icon.setAttribute("aria-hidden", "true");
  if (row.icon) {
    const image = document.createElement("img");
    image.src = row.icon;
    image.alt = "";
    image.width = ICON_SIZE;
    image.height = ICON_SIZE;
    icon.append(image);
  }
  link.append(icon, element("span", "", row.name));
  const head = element("div", "build-total-head");
  head.append(link);
  if (row.sum !== undefined) {
    const sum = element("span", "build-total-sum");
    sum.dataset.sum = "";
    sum.append(element("span", "build-total-sum-label", labels.totalsSum), element("span", "build-total-sum-value", row.sum));
    head.append(sum);
  }
  const parts = element("ul", "build-total-parts");
  parts.append(...row.parts.map((part) => element("li", "", partText(part, labels))));
  item.append(head, parts);
  return item;
}

function group(title: string, kind: string, rows: readonly TotalRow[], labels: BuildPayload["labels"]): HTMLElement[] {
  if (rows.length === 0) return [];
  const block = element("div", "build-total-group");
  block.dataset.kind = kind;
  const list = element("ul", "build-total-list");
  list.setAttribute("role", "list");
  list.append(...rows.map((row) => totalRow(row, labels)));
  block.append(element("h3", "build-total-title", title), list);
  return [block];
}

/** Fills the section, or hides it while the build has no effects or enchantments. */
export function renderTotals(section: HTMLElement, payload: BuildPayload, build: Build, effects: Effects, enchants: Enchants): void {
  const body = section.querySelector<HTMLElement>("[data-totals-body]");
  if (!body) return;
  const totals = buildTotals(payload, build, effects, enchants);
  const { labels } = payload;
  body.replaceChildren(...group(labels.totalsEffects, "effects", totals.effects, labels), ...group(labels.totalsEnchants, "enchants", totals.enchants, labels));
  section.hidden = body.childElementCount === 0;
}
